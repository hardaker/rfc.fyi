import json
from collections import defaultdict
from rfcjson import get_json


# open the rfc index
json_records = get_json(open("rfc-index.xml"))

stream_rfcs = defaultdict(list)

for item in json_records:
    tag = "stream:" + json_records[item]['stream']
    stream_rfcs[tag].append(item)

print(json.dumps(stream_rfcs, indent=1, sort_keys=True))
