"""Generate TypeScript data types from the backend's OpenAPI schemas."""
import argparse
import json
from pathlib import Path
import yaml

root = Path(__file__).resolve().parents[2]
schemas = yaml.safe_load((root / 'docs/implementation/contracts/openapi.yaml').read_text())['components']['schemas']

def type_of(value):
    if '$ref' in value:
        return value['$ref'].split('/')[-1]
    if 'enum' in value:
        return ' | '.join(json.dumps(item) for item in value['enum'])
    if 'anyOf' in value:
        return ' | '.join(type_of(item) for item in value['anyOf'])
    kind = value.get('type')
    if isinstance(kind, list):
        return ' | '.join(type_of({**value, 'type': item}) for item in kind)
    if kind == 'array':
        return '(' + type_of(value['items']) + ')[]'
    if kind == 'object':
        return '{ ' + '; '.join(key + ('' if key in value.get('required', []) else '?') + ': ' + type_of(item) for key, item in value.get('properties', {}).items()) + ' }'
    return {'string': 'string', 'integer': 'number', 'number': 'number', 'boolean': 'boolean', 'null': 'null'}[kind]

output = '\n'.join('export type ' + key + ' = ' + type_of(value) + '\n' for key, value in schemas.items())
target = root / 'frontend/src/api/schema.ts'
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
if parser.parse_args().check:
    if target.read_text() != output:
        raise SystemExit('API data types differ from OpenAPI. Run npm run api:types.')
else:
    target.write_text(output)
