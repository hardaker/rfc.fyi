
traceur := /usr/local/bin/traceur

rfcs.json: rfc-index.xml rfc-json.py
	cat rfc-index.xml | ./rfc-json.py > rfcs.json

.PHONY: rfc-index.xml
rfc-index.xml:
	curl "https://www.rfc-editor.org/rfc-index.xml" -o $@

client-es5.js: client.js util.js
	$(traceur) --out client-es5.js client.js

.PHONY: server
server:
	python -m SimpleHTTPServer

.PHONY: lint
lint: client.js util.js
	standard --fix client.js util.js

.PHONY: clean
clean:
	rm -f rfcs.json rfcs.json.gz

.PHONY: update-streams
update-streams:
	PYTHONPATH=. generators/stream-extractors.py -m tags.json 

