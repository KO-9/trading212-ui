etlocal
FOR /F "tokens=*" %%i in ('type .env') do SET %%i

start "" node main.js
ping 127.0.0.1 -n 3 > nul
start "" http://localhost:%HTTP_PORT%