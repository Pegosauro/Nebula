from pathlib import Path
import json, zipfile, copy
root=Path(__file__).resolve().parents[1]
vault=root/'test-vault'
quantity=lambda n=1,p=None,d=1,r='none':dict(amount=n,divisor=d,rounding=r,**({'parameter':p} if p else {}))
def action(c,n=1,p=None,d=1,r='none'):return dict(type='add',component=c,components=[],parameter='',value='',quantity=quantity(n,p,d,r))
def cond(p,v,op='eq'):return dict(parameter=p,operator=op,value=v)
def node(id,p,v,op='eq'):return dict(id=id,type='condition',condition=cond(p,v,op))
parameters=[dict(id='model',name='MODELLO',type='choice',values=['BASE','TELO','BIO'],unit=''),dict(id='led',name='LED',type='boolean',values=[],unit='',optionRules=[dict(value=True,enabled=True,expression=node('led-eligible','model','BASE','ne'))]),dict(id='telo',name='TELO',type='boolean',values=[],unit='',optionRules=[dict(value=True,enabled=True,expression=node('telo-eligible','model','TELO'))]),dict(id='width',name='Larghezza',type='number',values=[],min=250,max=400,step=50,unit='cm'),dict(id='depth',name='Sporgenza',type='number',values=[],min=200,max=400,step=100,unit='cm'),dict(id='color',name='Colore',type='choice',values=['Bianco','Antracite','Bronzo'],unit=''),dict(id='mount',name='Montaggio',type='choice',values=['Addossata','Autoportante'],unit='')]
parameters.append(dict(id='material',name='Materiale telo',type='text',values=['PVC','Acrilico'],allowCustom=True,unit=''))
components=[];rules=[]
for i in range(1,25):
 id=f'c{i:02}';profile=i<=6;family='PROFILI' if profile else 'ACCESSORI';group='Telaio' if profile else 'Illuminazione' if i<=10 else 'Fissaggi' if i<=18 else 'Copertura'
 c=dict(id=id,code=f'{"PR" if profile else "AC"}{i:03}',name=(['Traverso frontale','Traverso posteriore','Longherone sinistro','Longherone destro','Montante','Profilo di chiusura'][i-1] if profile else f'{group} · elemento {i:02}'),family=family,group=group,unit='pz',note=f'Schede/{id}.md')
 if profile:c['measure']=dict(parameter='width' if i<3 else 'depth',offset=-1 if i<5 else 0,unit='cm')
 if i==19:
  c['name']='Telo di copertura'
  c['properties']=[dict(id='telo-materiale',name='Materiale',parameter='material')]
  c['dimensions']=[dict(id='telo-L',name='Larghezza',parameter='width',offset=-2,unit='cm'),dict(id='telo-H',name='Altezza',parameter='depth',offset=-3,unit='cm')]
 if i==20:
  c['name']='Bordo di protezione'
  c['properties']=[dict(id='bordo-materiale',name='Materiale',parameter='material',value='Poliestere')]
 components.append(c)
 conditions=[]
 if 7<=i<=10:conditions=[cond('led',True)]
 elif i>=19:conditions=[cond('telo',True)]
 elif i==5:conditions=[cond('mount','Autoportante')]
 rule=dict(id=f'R{i:02}',name=f'Inclusione {c["code"]}',enabled=True,match='all',conditions=conditions,componentIds=[id],actions=[action(id,2 if profile else 1)])
 if 11<=i<=18:rule['actions']=[action(id,1,'width',100,'ceil')]
 if i==6:rule['expression']=dict(id='or-model',type='any',children=[node('model-bio','model','BIO'),dict(id='nested-and',type='all',children=[node('model-telo','model','TELO'),dict(id='not-bronze',type='not',child=node('bronze','color','Bronzo'))])])
 rules.append(rule)
data=dict(format='nebula-configurator',version=8,title='Pergola dimostrativa',parameters=parameters,components=components,rules=rules)
files={'00_INIZIA_QUI.md':'''# Vault di prova Nebula

Dati dimostrativi, senza informazioni personali. Puoi modificarli liberamente.

## Percorso di verifica

1. Apri [[Configurators/Pergola dimostrativa.config.json]].
2. In BOM scegli TELO = Sì prima di scegliere MODELLO: deve essere consentito.
3. Imposta MODELLO = TELO, Larghezza = 300 cm e Sporgenza = 300 cm.
4. PR001: misura 299 cm per pezzo, quantità 2 pz. AC019: telo L 298 × H 297 cm, quantità 1 pz.
5. Esci nella nota [[Progetti/Pergola campione]] e riapri il configuratore: scelte e vista devono restare.
6. Scegli Materiale telo = PVC oppure Acrilico: AC019 segue la scelta. AC020 mantiene Materiale: Poliestere. Puoi anche scrivere un testo personalizzato.
7. Prova ricerca, filtri, raggruppamento e zoom del grafo.
8. Apri [[Configurators/Diagnostica intenzionale.config.json]] per segnalazioni intenzionali.
9. Apri [[Strutture/FL · Tenda finestra.tree.json]] nella sezione Strutture: albero, categorie e oggetti.

## Conservazione

Il Vault di prova integrato usa file locali nell’archivio del browser, separati dalle cartelle personali. La copia ZIP si può estrarre e aprire come normale cartella desktop. Riaprire la prova conserva le modifiche esistenti. I file di prova nel browser possono essere rimossi cancellando i dati del sito: usa la copia ZIP per una versione portatile.
''','Progetti/Pergola campione.md':'# Pergola campione\n\n[[Configurators/Pergola dimostrativa.config.json]]\n\n## Obiettivo\n\nTelaio largo 300 cm. Due traversi da 299 cm.\n\n- [ ] Controllare quantità e misura separatamente\n- [ ] Verificare opzioni LED e TELO\n\nVedi [[Procedure/Controllo distinta]] e [[Schede/c01]].\n','Procedure/Controllo distinta.md':'# Controllo distinta\n\n## Parametri\n\nUsare MODELLO = TELO e Larghezza = 300 cm.\n\n## Risultato atteso\n\n| Codice | Misura | Quantità |\n| --- | --- | --- |\n| PR001 | 299 cm | 2 pz |\n| PR002 | 299 cm | 2 pz |\n\n[[Progetti/Pergola campione]]\n','Appunti veloci.md':'# Appunti veloci\n\n## 15/10/2026 · 09:00:00\n\nVerificare i profili a misura e i fissaggi.\n'}
for c in components:files[c['note']]=f'# {c["code"]} · {c["name"]}\n\nFamiglia: {c["family"]}\n\nGruppo: {c["group"]}\n\n[[Progetti/Pergola campione]]\n'
files['Configurators/Pergola dimostrativa.config.json']=json.dumps(data,ensure_ascii=False,indent=2)
free=copy.deepcopy(data);free['title']='Misure libere';free['parameters'][3].pop('step');files['Configurators/Misure libere.config.json']=json.dumps(free,ensure_ascii=False,indent=2)
bad=copy.deepcopy(data);bad['title']='Diagnostica intenzionale';bad['components'][1]['code']='PR001';bad['parameters'][0]['values']=['BASE','BASE'];files['Configurators/Diagnostica intenzionale.config.json']=json.dumps(bad,ensure_ascii=False,indent=2)
files['Strutture/FL · Tenda finestra.tree.json']=(root/'src/features/trees/tendaFinestra.tree.json').read_text(encoding='utf-8')
for path,content in files.items():p=vault/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content,encoding='utf-8')
(root/'src/features/vault/testVaultFiles.json').write_text(json.dumps(files,ensure_ascii=False),encoding='utf-8')
zip_path=root/'public/samples/Nebula-Vault-Test.zip';zip_path.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(files):z.write(vault/path,'Nebula-Vault-Test/'+path)
print(f'{len(files)} file, 3 configuratori, 1 struttura, 24 componenti per progetto')
