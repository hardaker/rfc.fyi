#!/usr/bin/python3

"""Reads an RFC index and outputs a list of RFCs per stream"""

import json
from collections import defaultdict
from rfcjson import get_json

from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter, FileType
import sys


def parse_args():
    parser = ArgumentParser(formatter_class=ArgumentDefaultsHelpFormatter,
                            description=__doc__,
                            epilog="Example Usage: stream-extractors.py -i rfc-index.xml -p")

    parser.add_argument("-i", "--rfc-index", default="rfc-index.xml", type=str,
                        help="The rfc-index.xml file to read in")

    parser.add_argument("-p", "--print", action="store_true",
                        help="Print the results to stdout")

    parser.add_argument("-m", "--merge-into", default=None, type=str,
                        help="Merge results into an existing (tags.json) file")

    args = parser.parse_args()
    return args


def get_stream_data(filename):
    # open the rfc index
    json_records = get_json(open(filename))

    stream_rfcs = defaultdict(list)

    for item in json_records:
        tag = "stream:" + json_records[item]['stream']
        stream_rfcs[tag].append(item)

    return stream_rfcs


def merge_into(stream_data, filename):
    with open(filename) as fh:
        existing_data = json.load(fh)
    existing_data.update(stream_data)

    with open(filename, "w") as fh:
        json.dump(existing_data, fh, indent=4, sort_keys=True)


def main():
    args = parse_args()
    stream_data = get_stream_data(args.rfc_index)

    if args.print:
        print(json.dumps(stream_data, indent=1, sort_keys=True))

    if args.merge_into:
        merge_into(stream_data, args.merge_into)


if __name__ == "__main__":
    main()
