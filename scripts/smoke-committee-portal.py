#!/usr/bin/env python3
"""Verify existing department credentials authorize both protected dashboards."""
import argparse
import http.cookiejar
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('url')
parser.add_argument('--expect-news-task', help='Verify a known existing news item is returned to each authorized scope')
args = parser.parse_args()
url = args.url.rstrip('/')
target = urllib.parse.urlparse(url)
if target.scheme != 'https' or not target.hostname or not (target.hostname == 'shari3ahtask.netlify.app' or target.hostname.endswith('--shari3ahtask.netlify.app')) or target.username or target.password:
    raise ValueError('Smoke verification only accepts this portal and its Netlify previews')
passwords = json.loads((Path.home() / 'Library/Application Support/tu-course-reports/access-provisional.json').read_text())['passwords']
for scope, password in passwords.items():
    jar = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    login_request = urllib.request.Request(url + '/api/course/login', data=json.dumps({'password': password}).encode(), headers={'Content-Type': 'application/json'})
    with client.open(login_request, timeout=30) as response:
        assert json.load(response)['scope'] == scope
    with client.open(url + '/api/course/committee-data?' + urllib.parse.urlencode({'department': 'قسم آخر', 'scope': 'all'}), timeout=30) as response:
        committee = json.load(response)
        assert 'no-store' in response.headers.get('Cache-Control', '')
    assert len(committee['records']) == (340 if scope == 'all' else 85)
    assert scope == 'all' or all(row['department'] == scope for row in committee['records'])
    assert isinstance(committee.get('news'), list) and not committee.get('newsUnavailable', False)
    assert scope == 'all' or all(row['department'] == scope for row in committee['news'])
    if args.expect_news_task and any(row['id'] == args.expect_news_task for row in committee['records']):
        assert any(row['taskId'] == args.expect_news_task for row in committee['news']), 'Expected saved committee news was not returned'
    with client.open(url + '/api/course/data', timeout=30) as response:
        courses = json.load(response)
    assert courses['scope'] == scope
    assert scope == 'all' or all(row[3] == scope for row in courses['courseRows'])
    print(scope, 'tasks', len(committee['records']), 'course sections', len(courses['courseRows']), 'shared session OK', flush=True)
    with client.open(urllib.request.Request(url + '/api/course/logout', data=b'{}', headers={'Content-Type': 'application/json'}), timeout=30) as response:
        assert json.load(response)['ok']
    for action in ['committee-data', 'data']:
        try:
            client.open(url + '/api/course/' + action, timeout=30)
            raise AssertionError('Logout failed')
        except urllib.error.HTTPError as error:
            assert error.code == 401
print('Shared login, server-side department isolation, private responses and shared logout passed.')
