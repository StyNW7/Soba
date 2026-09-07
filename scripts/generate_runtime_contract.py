import yaml,json,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
x=yaml.safe_load((root/'docs/implementation/contracts/openapi.yaml').read_text())
ops=[]
for path,item in x['paths'].items():
 for method,op in item.items():
  if not isinstance(op,dict) or 'operationId' not in op:continue
  params=[]
  for p in op.get('parameters',[]):
   if '$ref' in p:p=x['components']['parameters'][p['$ref'].split('/')[-1]]
   params.append(p)
  request=op.get('requestBody',{}).get('content',{}).get('application/json',{}).get('schema')
  response={k:v.get('content',{}).get('application/json',{}).get('schema') for k,v in op['responses'].items() if k.startswith(('2','3'))}
  ops.append(dict(path=path,method=method.upper(),id=op['operationId'],security=op.get('security',x.get('security',[])),parameters=params,request=request,responses=response))
(root/'backend/internal/httpapi/contract.json').write_text(json.dumps(dict(components=x['components'],operations=ops)))
