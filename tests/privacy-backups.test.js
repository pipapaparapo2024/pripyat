const {execFileSync}=require('node:child_process');
process.stdout.write(execFileSync('python',['tests/_python_fixtures/privacy_backups.py'],{encoding:'utf8'}));
