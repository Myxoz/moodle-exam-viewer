import { NavigatableDir } from "./utils";

class MoodleCourse {
	shortName: string;
	fullName: string;
	courseHandle: NavigatableDir;
	gradesHandle: NavigatableDir;
	constructor(
		fullName: string,
		shortName: string,
		fileHandle: NavigatableDir,
		gradesHandle: NavigatableDir,
	) {
		this.shortName = shortName;
		this.fullName = fullName;
		this.courseHandle = fileHandle;
		this.gradesHandle = gradesHandle;
	}
	static async getKlausurCourses(entry: NavigatableDir): Promise<[MoodleCourse, MoodleKlausur[]] | undefined> {
		const parsedDataJson = await entry.json("data.json")
		if(parsedDataJson === undefined || parsedDataJson.fullname === undefined || parsedDataJson.shortname === undefined) return undefined;
		const gradesFolder = await entry.dir("Grades");
		if(gradesFolder == undefined) return undefined;

		const course = new MoodleCourse(parsedDataJson.fullname, parsedDataJson.shortname, entry, gradesFolder)

		const quizFolders = await entry.findFolders(f =>f.name.startsWith("Quiz "))
		const klausuren: MoodleKlausur[] = [];
		for(const quizFolder of quizFolders) {
			const dataJson = await quizFolder.json("data.json")
			if(dataJson != undefined) {
				const quizName = dataJson.name;
				if(	quizName == undefined ||
				   	quizName.toLowerCase().includes("probe") ||
					quizName.toLowerCase().includes("demo") ||
					!quizName.toLowerCase().includes("klausur")
				) continue;
				const attempts = await quizFolder.dir("Attempts").then(e=>e?.firstDir()).then(e=>e?.json("data.json"));
				if(typeof attempts?.timefinish != "string") continue;
				klausuren.push(new MoodleKlausur(course, quizFolder, new Date(attempts?.timefinish), quizName))
			}
		}
		if(klausuren.length == 0) return undefined;

		return [course, klausuren]
	}
}

class MoodleKlausur {
	course: MoodleCourse;
	quizHandle: NavigatableDir;
	dateWritten: Date;
	quizName: string;
	constructor(
		course: MoodleCourse,
		quizHandle: NavigatableDir,
		dateWritten: Date,
		quizName: string,
	) {
		this.course = course;
		this.quizHandle = quizHandle;
		this.dateWritten = dateWritten;
		this.quizName = quizName;
	}
	// age() { }
}
export {MoodleCourse, MoodleKlausur};
