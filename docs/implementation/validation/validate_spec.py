"""Validate this spec package; does not validate an application implementation."""
from pathlib import Path
import json,re,yaml
from jsonschema import Draft202012Validator,FormatChecker
from openapi_spec_validator import validate
root=Path(__file__).resolve().parents[1]
api=yaml.safe_load((root/'contracts/openapi.yaml').read_text())
validate(api)
ops=[o for methods in api['paths'].values() for o in methods.values()]
assert len({o['operationId'] for o in ops})==len(ops)
print(f'PASS OpenAPI: {len(api["paths"])} paths, {len(ops)} unique operations, {len(api["components"]["schemas"])} schemas')
for p in (root/'contracts').glob('*.schema.json'):
 Draft202012Validator.check_schema(json.loads(p.read_text()))
 print('PASS schema',p.name)
examples=json.loads((root/'contracts/examples.json').read_text())
for x in examples:
 schema=json.loads((root/'contracts'/x['schema']).read_text()) if x['schema'].endswith('.json') else {'$ref':'#/components/schemas/'+x['schema'],'components':api['components']}
 errors=list(Draft202012Validator(schema,format_checker=FormatChecker()).iter_errors(x['value']))
 assert (not errors)==x['valid'],(x['name'],[e.message for e in errors])
print('PASS examples:',len(examples),'positive and negative cases')
text=(root/'Acceptance-Tests.md').read_text()
for prefix,count in [('C',7),('U',9),('G',6)]:
 for i in range(1,count+1):assert f'| AT-{prefix}{i} |' in text
print('PASS all 22 requirements mapped to acceptance tests')
count=0
for p in root.parent.rglob('*.md'):
 content=p.read_text();assert content.count('```')%2==0,p
 for target in re.findall(r'\]\(([^)]+)\)',content):
  if target.startswith(('https://','http://','#','mailto:')):continue
  target=target.split('#')[0]
  assert (p.parent/target).exists(),(p,target)
  count+=1
print('PASS local document links:',count)
# Private guardian schemas must remain narrow and explicit.
for name in ['Pulse','Trends','ConnectionStatus','Alert','Subject']:
 schema=api['components']['schemas'][name]
 assert schema.get('additionalProperties') is False,name
 assert not {'journal','reflection','memory','transcript','assessment'} & set(schema['properties']),name
print('PASS guardian response field boundaries')
print('SQL tests are separate: use PostgreSQL with database/001_initial.sql then 002_invariant_tests.sql.')
