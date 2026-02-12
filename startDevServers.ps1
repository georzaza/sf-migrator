Start-process npm.cmd -ArgumentList "run dev"
cd SERVER
Start-process npm.cmd -ArgumentList "run start:dev"
cd ..
