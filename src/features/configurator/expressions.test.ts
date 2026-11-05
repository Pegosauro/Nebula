import { describe, expect, it } from "vitest";
import type { ConditionNode, Rule } from "./model";
import { exampleConfigurator, newAction, parseConfigurator } from "./model";
import { analyze, enumerate, evaluate, expressionMatches, matches } from "./engine";
import { conditionSummary, ruleConditions } from "./expressions";

let serial=0;
const leaf=(parameter:string,value:string|number|boolean=true):ConditionNode=>({id:`n${serial++}`,type:"condition",condition:{parameter,operator:"eq",value}});
const group=(type:"all"|"any",...children:ConditionNode[]):ConditionNode=>({id:`n${serial++}`,type,children});
const not=(child:ConditionNode):ConditionNode=>({id:`n${serial++}`,type:"not",child});
describe("nested logical expressions",()=>{
  it("evaluates the requested E(x; O(a;b;c); E(n;t)) over every boolean combination",()=>{
    const tree=group("all",leaf("x"),group("any",leaf("a"),leaf("b"),leaf("c")),group("all",leaf("n"),leaf("t")));
    for(let bits=0;bits<64;bits++) {
      const s=Object.fromEntries(["x","a","b","c","n","t"].map((id,i)=>[id,!!(bits & (1<<i))]));
      expect(expressionMatches(tree,s)).toBe(s.x && (s.a || s.b || s.c) && s.n && s.t);
    }
  });
  it("negates single conditions, entire groups and double negations without resolving unknowns",()=>{
    const tree=not(group("any",leaf("a"),leaf("b")));
    expect(expressionMatches(tree,{a:false,b:false})).toBe(true);
    expect(expressionMatches(tree,{a:true})).toBe(false);
    expect(expressionMatches(tree,{a:false})).toBeUndefined();
    expect(expressionMatches(not(leaf("a")),{})).toBeUndefined();
    expect(expressionMatches(not(not(leaf("a"))),{a:true})).toBe(true);
    expect(expressionMatches(group("all",leaf("a"),not(leaf("b"))),{a:false})).toBe(false);
  });
  it("uses trees for BOM quantities, exclusions, required values and enumeration",()=>{
    const d=exampleConfigurator("Nested");d.version=2;d.rules=[];
    const rule:Rule={id:"r",name:"Nested",enabled:true,match:"all",conditions:[],expression:group("all",leaf("model","A"),not(leaf("led"))),actions:[{...newAction(),component:"profile",quantity:{amount:2,divisor:1,rounding:"none"}}]};
    d.rules=[rule];
    expect(evaluate(d,{model:"A"}).possible[0]?.component).toBe("profile");
    expect(evaluate(d,{model:"A",led:false,width:3000}).bom[0]?.quantity).toBe(2);
    const variants=enumerate(d,{width:3000});
    expect(variants.solutions).toHaveLength(4);
    expect(variants.solutions.filter(s=>s.result.bom.length)).toHaveLength(1);
    d.rules.push({...rule,id:"exclude",actions:[{...newAction(),type:"exclude",component:"profile"}]});
    expect(enumerate(d,{width:3000}).solutions).toHaveLength(3);
    d.rules.pop();rule.actions.push({...newAction(),type:"requireValue",parameter:"led",value:true});
    expect(evaluate(d,{model:"A",led:false,width:3000}).errors.join()).toContain("deve essere Sì");
  });
  it("preserves old files and round-trips version 2 with mixed legacy and nested rules",()=>{
    const d=exampleConfigurator("Files"), old=parseConfigurator(JSON.stringify(d));
    expect(old).toEqual(d);
    d.version=2;d.rules[0]!.expression=group("all",leaf("model","A"),not(leaf("led")));
    const restored=parseConfigurator(JSON.stringify(d));expect(restored).toEqual(d);
    expect(matches(restored.rules[0]!,{model:"A",led:false})).toBe(true);
    expect(matches(restored.rules[1]!,{led:true})).toBe(true);
    expect(ruleConditions(restored.rules[0]!)).toHaveLength(2);
    expect(conditionSummary(restored.rules[0]!,d)).toBe('E(Modello = "A"; NON(LED = Sì))');
    d.version=1;expect(()=>parseConfigurator(JSON.stringify(d))).toThrow("versione 2");
  });
  it("rejects malformed operators, duplicate IDs, missing NON targets and excessive depth",()=>{
    const d=exampleConfigurator("Invalid");d.version=2;
    for(const tree of [{id:"root",type:"xor",children:[]},{id:"root",type:"not"},{id:"root",type:"not",child:leaf("led"),children:[]},group("all",{...leaf("led"),id:"same"},{...leaf("model","A"),id:"same"})]) {
      d.rules[0]!.expression=tree as ConditionNode;
      expect(()=>parseConfigurator(JSON.stringify(d))).toThrow();
    }
    let deep=leaf("led");for(let i=0;i<34;i++)deep=not(deep);
    d.rules[0]!.expression=deep;expect(()=>parseConfigurator(JSON.stringify(d))).toThrow("troppo complesso");
  });
  it("checks nested references and incomplete scopes without flattening O or NON into E",()=>{
    const d=exampleConfigurator("Analysis");d.version=2;
    d.rules[0]!.expression=group("any",leaf("model","A"),leaf("model","B"),not(leaf("led")));
    expect(analyze(d).some(i=>i.message.includes("incompatibili"))).toBe(false);
    d.rules[0]!.expression=group("all",leaf("model","A"),group("all",leaf("model","B")));
    expect(analyze(d).some(i=>i.message.includes("incompatibili"))).toBe(true);
    d.rules[0]!.expression=group("all",not(leaf("missing")),group("any"));
    expect(analyze(d).map(i=>i.message).join()).toContain("parametro della condizione mancante");
    expect(analyze(d).map(i=>i.message).join()).toContain("Gruppo vuoto");
    expect(expressionMatches(not(group("all")),{})).toBeUndefined();
    expect(expressionMatches(group("all"),{})).toBe(true);
  });
});
