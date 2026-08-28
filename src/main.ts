import { MoodleCourse, MoodleKlausur } from "./clazzes";
import { NavigatableDir, parseJSON } from "./utils";

async function selectFolder() {
	const allMoodleKlausurCourses: [MoodleCourse, MoodleKlausur[]][] = [];
	do {
		const folder = await window.showDirectoryPicker({ mode: "read" });
		const queue = [new NavigatableDir(folder)];
		while (queue.length != 0) {
			const currentFolder = queue.shift();
			if (!currentFolder) break;
			if (currentFolder.name.startsWith("Course")) {
				const possiblyValidCourse = await MoodleCourse.getKlausurCourses(currentFolder)
				if (possiblyValidCourse !== undefined) {
					allMoodleKlausurCourses.push(possiblyValidCourse)
				}
				continue;
			}
			queue.push(...await currentFolder.dirs());
		}
		if (allMoodleKlausurCourses.length == 0) {
			alert("Kein Moodle Kurs konnte gefunden werden.")
		}
	} while (allMoodleKlausurCourses.length == 0)

	const introductionElement = document.getElementById("introduction");
	if (introductionElement !== null) introductionElement.style.display = "none";
	selectCourses(allMoodleKlausurCourses);
}

function selectCourses(courses: [MoodleCourse, MoodleKlausur[]][]) {
	if (courses.length == 1) {
		selectQuiz(courses[0])
		return;
	}

	const courseSelection = document.getElementById("courseSelection");
	if (courseSelection !== null) {
		courseSelection.style.display = "flex";
		courses.forEach(course => {
			const div = document.createElement("div");
			div.classList.add("moodleCourse");
			div.innerHTML = `<h2>${course[0].fullName}</h2><h3>${course[0].shortName}</h3>`;
			div.addEventListener("click", _ => { selectQuiz(course); courseSelection.style.display = "none" })
			courseSelection.appendChild(div)
		})
	}
}

function selectQuiz(quizes: [MoodleCourse, MoodleKlausur[]]) {
	if (quizes[1].length == 1) {
		showEinsicht(quizes[1][0], RenderMode.Review)
		return;
	}
	const quizSelection = document.getElementById("quizSelection");
	if (quizSelection !== null) {
		quizSelection.style.display = "flex";
		quizes[1].forEach(quiz => {
			const div = document.createElement("div");
			div.classList.add("moodleQuiz");
			div.innerHTML = `<h2>${quiz.quizName}</h2><h3>${quiz.dateWritten.toLocaleString()}</h3>`;
			div.addEventListener("click", _ => { showEinsicht(quiz, RenderMode.Review); quizSelection.style.display = "none" })
			quizSelection.appendChild(div)
		})
	}
}

enum RenderMode {
	Interactive, ForDownload, Review
}

const renderModes = [RenderMode.Review, RenderMode.ForDownload, RenderMode.Interactive];
const renderModeTitle = ["Review", "Zum Download", "Interaktiv"]
const renderModeDescription = [
	"Für die Einsicht seiner eigenen Klausur",
	"Für das Herrunterladen der Klausur ohne eigene Eingaben und mit allen Dropdown Optionen, Drucken -> Exportieren als PDF, Klicke auf weitere Optionen und schalte Hintergrund Graphiken ein",
	"Für die Interaktion mit der Klausur, als würdest du sie gerade schreiben"
];

async function showEinsicht(klausur: MoodleKlausur, renderMode: RenderMode) {
	const einsichtElement = document.getElementById("einsicht");
	if (einsichtElement == null) return;
	einsichtElement.textContent = ""
	const tasksFolder = await klausur.quizHandle
		.dir("Attempts")
		.then(e => e?.firstDir())
		.then(e => e?.dir("Questions"))
		.then(e => e?.dirs())
		.then(e => e?.sort((a, b) => Number(a.name.substring(1)) - Number(b.name.substring(1))))
	const modusDiv = document.createElement("div")
	modusDiv.id = "modusBar"
	einsichtElement.appendChild(modusDiv)
	const modusSpan = document.createElement("span")
	modusSpan.innerHTML = "Modus: "
	modusDiv.appendChild(modusSpan)
	const select = document.createElement("select")
	modusDiv.appendChild(select)
	for (const [i, _] of renderModes.entries()) {
		const option = document.createElement("option")
		option.value = i.toString()
		option.innerHTML = renderModeTitle[i]
		option.title = renderModeDescription[i]
		select.appendChild(option)
	}
	select.value = renderModes.indexOf(renderMode).toString()
	select.addEventListener("change", _=>{
		showEinsicht(klausur, renderModes[+select.value])
	})
	if (tasksFolder === undefined) return;
	for (const taskFolder of tasksFolder) {
		const taskElement = document.createElement("div")
		taskElement.classList.add("moodleTask");
		const jsonContent = await taskFolder.json("data.json")
		if (!jsonContent) return;

		// 1. Name der Aufgabe
		// Typ: String
		if (jsonContent === undefined ||
			jsonContent.name === undefined ||
			jsonContent.question === undefined ||
			jsonContent.answer === undefined ||
			jsonContent.timemodified === undefined
		) continue;
		const taskName = jsonContent.name;
		const taskQuestion = jsonContent.question;
		const taskAnswer = jsonContent.answer;
		if (taskQuestion === null) continue;
		// const taskTimeModified = new Date(jsonContent.timemodified);
		// <span>${taskTimeModified.toLocaleString()}</span>
		for (const elem of renderTaskAsHTML(taskName, taskQuestion, taskAnswer, renderMode)) {
			taskElement.appendChild(elem)
		}
		// JSON.stringify(jsonContent)
		einsichtElement.appendChild(taskElement)
	}
}
function formatCell(text: string, answer: Iterator<string> | undefined, renderMode: RenderMode): HTMLElement {
	const multipleChoiceRegex = /^{([^;]*; )+[^;}]+}$/
	if (multipleChoiceRegex.test(text)) {
		if(renderMode == RenderMode.Review) {
			const div = document.createElement("div")
			div.classList.add("select")
			div.innerText = answer?.next()?.value || "Keine Antwort"
			return div
		} else {
			const innerPart = text.substring(1, text.length - 1)
			const optionList = innerPart
				.split(";")
				.map(answer => answer.trim())
			if(renderMode == RenderMode.Interactive) {
				const select = document.createElement("select");
				optionList.forEach(answer => {
					const option = document.createElement("option");
					option.value = answer;
					option.textContent = answer;
					select.appendChild(option);
				})
				return select;
			} else {
				const div = document.createElement("div")
				div.classList.add("forDownloadList")
				optionList.forEach(answer => {
					const option = document.createElement("div");
					option.classList.add("select")
					option.textContent = answer;
					div.appendChild(option);
				})
				return div;
			}
		}
	} else {
		const span = document.createElement("span")
		span.innerText = text
		return span
	}
}

function renderTaskAsHTML(taskTitle: string, taskQuestion: string, taskAnswer: string | null, renderMode: RenderMode): HTMLElement[] {
	const elementStack: HTMLElement[] = []
	const titleElement = document.createElement("h3")
	titleElement.innerText = taskTitle
	elementStack.push(titleElement)
	// AI Generated & human rewritten (Not true anymore, I wanted to
	// Vibe Code this. Why do you need to do anything yourself, go for it, steal my job!)
	const tableRegex = /(\n(\n\t\t[^\n\t]+)+)+\n\n$/;
	const clozeRegex = /\[\[\d+\]\][\s\S]*?\n\s*;\s*\[\[\d+\]\]\s*->\s*\{/;
	const checkboxTableRegex = /(\n(\n\t\t[^\n\t]+)+)+\n(\n\t\t[^\n\t]+\n\n({([^;}]*; )+[^;}]+}\n)+)+\n$/
	var answerIterator = taskAnswer != null ? taskAnswer
		.split(";")
        .map(item => item.replace(/^\s?part \d+:\s*/, "")) // Entfernt "part X: "
        .values()                                       // Erstellt den Iterator
    : undefined;
	if (tableRegex.test(taskQuestion)) { // Multiple Choice Table Question e.x. Solid
		titleElement.dataset["renderedBy"] = "Multiple Choice Table Question"

		const preTextElement = document.createElement("p");
		preTextElement.innerText = taskQuestion.substringBefore("\n\n\t\t");
		elementStack.push(preTextElement)
		const tableWithEnd = taskQuestion.substringAfter("\n\n\t\t")
		const table = tableWithEnd.substring(0, tableWithEnd.length - 2)

		const rows = table.split("\n\n\t\t")

		const tableElement = document.createElement("table");

		for (const row of rows) {
			const parts = row.split("\n\t\t")
			const tr = document.createElement("tr");

			for (const part of parts) {
				const td = document.createElement("td");
				td.appendChild(formatCell(part, answerIterator, renderMode))
				tr.appendChild(td);
			}
			tableElement.appendChild(tr);
		}

		elementStack.push(tableElement);
	} else if (checkboxTableRegex.test(taskQuestion)) {
		titleElement.dataset["renderedBy"] = "Checkbox Table Question";

		const preText = taskQuestion.substringBefore("\n\n\t\t");
		if (preText) {
			const preTextElement = document.createElement("p");
			preTextElement.innerText = preText;
			elementStack.push(preTextElement);
		}

		const table = taskQuestion.substringAfter("\n\n\t\t").trim();
		const rows = table.split("\n\n");
		const tableElement = document.createElement("table");

		// Render header row
		const headerTr = document.createElement("tr");
		rows[0].split("\n\t\t").forEach(h => {
			const th = document.createElement("th");
			th.innerText = h.trim();
			headerTr.appendChild(th);
		});
		tableElement.appendChild(headerTr);
		var previousRow: HTMLElement | null = null;

		// Render data rows
		for (let i = 1; i < rows.length; i++) {
			const parts = rows[i].split("\n").map(s => s.trim()).filter(Boolean);
			const isLabel = i % 2 == 0;
			var tr = isLabel ? previousRow : document.createElement("tr");
			previousRow = tr;

			if(!isLabel) {
				const labelTd = document.createElement("td");
				labelTd.innerText = parts[0];
				tr.appendChild(labelTd);
			} else {
				parts.forEach(option => {
					const td = document.createElement("td");
					td.appendChild(formatCell(option, answerIterator, renderMode));
					tr.appendChild(td);
				});
			}

			tableElement.appendChild(tr);
		}

		elementStack.push(tableElement);
	} else if (clozeRegex.test(taskQuestion)) { // Drop Downs

		// This spoils solutions, keep in mind
		// Algorithm is qtype_gapselect
		titleElement.dataset["renderedBy"] = "Drop Downs"
		const splitMatch = taskQuestion.search(/\n\s*;\s*\[\[/);
		const qText = splitMatch !== -1 ? taskQuestion.substring(0, splitMatch) : taskQuestion;
		const defs = splitMatch !== -1 ? taskQuestion.substring(splitMatch) : "";

		const groups = [...defs.matchAll(/\{([^}]+)\}/g)].map(m => m[1].split("/").map(x => x.trim()));
		const container = document.createElement("span");
		answerIterator = taskAnswer != null ? Array.from(
			taskAnswer.matchAll(/\{([^}]+)\}|(\S+)/g),
			match => match[1] || match[2]
		).values() : undefined;

		const findGroup = (choiceId: number) => {
			let count = 0;
			for (const g of groups) {
				count += g.length;
				if (choiceId <= count) return g;
			}
			return groups[0] || [];
		};

		qText.split(/\[\[(\d+)\]\]/).forEach((part, i) => {
			if (i % 2 === 0) {
				part.split("\n").forEach((line, j, arr) => {
					if (line) container.appendChild(document.createTextNode(line));
					if (j < arr.length - 1) container.appendChild(document.createElement("br"));
				});
			} else {
				const group = findGroup(parseInt(part, 10))
				container.appendChild(formatCell("{"+group.join("; ")+"}", answerIterator, renderMode))
			}
		});

		elementStack.push(container);
	} else if (/\{true;\s*no response;\s*false\}/.test(taskQuestion)) { // Checkbox questions
		titleElement.dataset["renderedBy"] = "Checkbox Questions"
		const checkboxRegex = /\{true;\s*no response;\s*false\}\t\t/g;

		const parts = taskQuestion.split(checkboxRegex);

		const preText = parts.shift()
		if (preText != undefined) {
			const preTextElement = document.createElement("p");
			preTextElement.innerText = preText;
			elementStack.push(preTextElement);
		}

		for (let i = 0; i < parts.length; i++) {
			if (parts[i]) {
				const textElement = document.createElement("span");
				const label = document.createElement("label");
				label.innerText = i == parts.length - 1 ? parts[i].substringBefore("\n\n") : parts[i];
				textElement.appendChild(formatCell("{true; no response; false}", answerIterator, renderMode))
				textElement.appendChild(label)
				elementStack.push(textElement);
			}
		}
	} else if (/(\n|^)[;:]\s*[^\n]+/.test(taskQuestion)) { // Checkbox question with ; and :
		titleElement.dataset["renderedBy"] = "Checkbox Questions with ; :"
		const checkboxRegex = /(?:^|\n)[;:]\s*/;
		const parts = taskQuestion.split(checkboxRegex);
		const preText = parts.shift();

		if (preText?.trim()) {
			const preTextElement = document.createElement("p");
			preTextElement.innerText = preText.trim();
			elementStack.push(preTextElement);
		}

		for (const part of parts) {
			const text = part
				.substringBefore("\n\n")
				.trim();

			if (!text) {
				continue;
			}

			const textElement = document.createElement("span");

			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";

			const label = document.createElement("label");
			label.innerText = text;

			textElement.appendChild(checkbox);
			textElement.appendChild(label);

			elementStack.push(textElement);
		}
	} else if (/\{([^;}]*; )+[^;}]+\}/.test(taskQuestion)) { // Dropdown question
		titleElement.dataset["renderedBy"] = "Dropdown Question"
		const multipleChoiceHolder = document.createElement("p")

		const tokenRegex = /\{([^;}]*; )+[^;}]+\}/g;
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = tokenRegex.exec(taskQuestion)) !== null) {
			if (match.index > lastIndex) {
				const plainText = taskQuestion.substring(lastIndex, match.index);
				multipleChoiceHolder.appendChild(formatCell(plainText, answerIterator, renderMode));
			}

			const choiceText = match[0];
			multipleChoiceHolder.appendChild(formatCell(choiceText, answerIterator, renderMode));

			lastIndex = tokenRegex.lastIndex;
		}

		if (lastIndex < taskQuestion.length) {
			const remainingText = taskQuestion.substring(lastIndex);
			multipleChoiceHolder.appendChild(formatCell(remainingText, answerIterator, renderMode));
		}
		elementStack.push(multipleChoiceHolder)

	} else {
		titleElement.dataset["renderedBy"] = "Other"
		const questionContent = document.createElement("p")
		questionContent.innerText = taskQuestion
		elementStack.push(questionContent)
		// Check code answer
		// Check code answer
		if (taskAnswer) {
			const tryJson = parseJSON(taskAnswer);
			const saharaAnswer = tryJson?.["sahara-answer"];

			if (Array.isArray(saharaAnswer) && saharaAnswer.length > 0) {
				let lines = saharaAnswer;

				// If the first element is a JSON string containing the actual array/string
				if (typeof saharaAnswer[0] === "string" && (saharaAnswer[0].startsWith("[") || saharaAnswer[0].startsWith('"'))) {
					const parsed = parseJSON(saharaAnswer[0]);
					if (parsed) lines = parsed;
				}

				const codeInput = document.createElement("textarea");

				codeInput.placeholder = "Gib Code ein"

				if (renderMode === RenderMode.Review) {
					// Flatten array if needed, then set .value for accurate newline rendering
					codeInput.value = Array.isArray(lines) ? lines.join("\n") : String(lines);
				}

				elementStack.push(codeInput);
			}
		}
	}
	return elementStack;
}

(window as any).selectFolder = selectFolder;
export { };
