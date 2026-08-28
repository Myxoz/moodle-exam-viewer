type FileType = FileSystemDirectoryHandle | FileSystemFileHandle;
declare global {
  interface String {
    substringBefore(delimiter: string, missingDelimiterValue?: string): string;
    substringAfter(delimiter: string, missingDelimiterValue?: string): string;
  }
}

String.prototype.substringBefore = function (
  delimiter: string,
  missingDelimiterValue: string = this
): string {
  const index = this.indexOf(delimiter);
  return index === -1 ? missingDelimiterValue : this.substring(0, index);
};

String.prototype.substringAfter = function (
  delimiter: string,
  missingDelimiterValue: string = this
): string {
  const index = this.indexOf(delimiter);
  return index === -1 ? missingDelimiterValue : this.substring(index + delimiter.length);
};

class NavigatableDir {
	name: string;
    constructor(
        readonly handle: FileSystemDirectoryHandle
    ) {
		this.name = handle.name
	}

	async dir(name: string): Promise<NavigatableDir | undefined> {
		try {
			return new NavigatableDir(
				await this.handle.getDirectoryHandle(name)
			);
		} catch {
			return undefined;
		}
	}

	async file(name: string): Promise<FileSystemFileHandle | undefined> {
		try {
			return await this.handle.getFileHandle(name);
		} catch {
			return undefined;
		}
	}

    async getContents(): Promise<FileSystemHandle[]> {
        const result: FileSystemHandle[] = [];
        for await (const entry of this.handle.values()) {
            result.push(entry);
        }
        return result;
    }

    async json(name: string): Promise<any | undefined> {
        const file = await this.file(name);
        if (!file) return undefined;

		return parseJSON(await (await file.getFile()).text());
	}
	async firstDir(): Promise<NavigatableDir | undefined> {
		for await (const entry of this.handle.values()) {
			if (entry.kind === "directory") {
				return new NavigatableDir(entry);
			}
		}

		return undefined;
	}
	async findFolder(predicate: (e: NavigatableDir) => Boolean): Promise<NavigatableDir | undefined> {
		return (await this.findFolders(predicate)).shift()
	}
	async findFolders(predicate: (e: NavigatableDir) => Boolean): Promise<NavigatableDir[]> {
		return (await this.dirs()).filter(predicate)
	}
	async findFile(predicate: (e: FileSystemFileHandle) => Boolean): Promise<FileSystemFileHandle | undefined> {
		return (await this.findFiles(predicate)).shift()
	}
	async findFiles(predicate: (e: FileSystemFileHandle) => Boolean): Promise<FileSystemFileHandle[]> {
		return (await this.files()).filter(predicate)
	}
	async filter(predicate: (e: FileSystemHandle) => Boolean): Promise<FileSystemHandle[]> {
		return (await this.getContents()).filter(predicate);
    }
	async dirs(): Promise<NavigatableDir[]>{
		return (await this.getContents())
			.filter((e): e is FileSystemDirectoryHandle => e.kind === 'directory')
			.map(e=>new NavigatableDir(e))
	}
	async files(): Promise<FileSystemFileHandle[]> {
		return (await this.getContents())
			.filter((e): e is FileSystemFileHandle => e.kind === 'file');
	}
}

function parseJSON(json: string): any | undefined {
    try {
        return JSON.parse(json);
    } catch (e) {
        return undefined;
    }
}

export {NavigatableDir, parseJSON};
