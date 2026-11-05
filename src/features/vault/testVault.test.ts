import { describe, expect, it, vi, afterEach } from "vitest";
import { createTestVault } from "./testVault";
class Directory {
  directories = new Map<string,Directory>();
  files = new Map<string,{content:string;writes:number}>();
  constructor(readonly name:string){}
  async getDirectoryHandle(name:string, options?:{create?:boolean}) {
    if(!this.directories.has(name)) {
      if(!options?.create) throw new DOMException("Missing","NotFoundError");
      this.directories.set(name,new Directory(name));
    }
    return this.directories.get(name)!;
  }
  async getFileHandle(name:string,options?:{create?:boolean}) {
    if(!this.files.has(name)) {
      if(!options?.create)throw new DOMException("Missing","NotFoundError");
      this.files.set(name,{content:"",writes:0});
    }
    const file=this.files.get(name)!;
    return {createWritable:async()=>({write:async(content:string)=>{file.content=content;file.writes++;},close:async()=>{},abort:async()=>{}})};
  }
}
afterEach(()=>vi.unstubAllGlobals());
describe("isolated populated test Vault",()=>{
  it("creates only within its own browser directory, preserves edits and fills missing fixture files",async()=>{
    const origin=new Directory("origin");
    vi.stubGlobal("navigator",{storage:{getDirectory:async()=>origin}});
    const opened=await createTestVault();
    const demo=origin.directories.get("Nebula-Vault-Test")!;
    expect(opened).toBe(demo);expect([...origin.directories.keys()]).toEqual(["Nebula-Vault-Test"]);
    const intro=demo.files.get("00_INIZIA_QUI.md")!;
    intro.content="Appunto modificato durante la prova";
    demo.directories.get("Schede")!.files.delete("c01.md");
    await createTestVault();
    expect(intro.content).toBe("Appunto modificato durante la prova");expect(intro.writes).toBe(1);
    expect(demo.directories.get("Configurators")!.files.size).toBe(3);
    expect(demo.directories.get("Schede")!.files.size).toBe(24);
  });
  it("reports missing browser storage without touching a user folder",async()=>{
    vi.stubGlobal("navigator",{storage:{}});
    await expect(createTestVault()).rejects.toThrow("Scarica ed estrai la copia ZIP");
  });
});
