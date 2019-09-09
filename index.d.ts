export as namespace SkaffolderCli;

export function getGenFiles(path: string): GeneratorFile[];

export class GeneratorFile {
  public name: string;
  public forEachObj: string;
  public overwrite: boolean;
  public template: string;
  public _partials: PartialFile[];
}

export class PartialFile {
  public name: string;
  public tagFrom: string;
  public tagTo: string;
  public template: string;
}
