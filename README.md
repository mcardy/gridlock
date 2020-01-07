# gridlock
An agent based traffic simulator web application. Winter 2020 Honors Project

# Running
To run locally, first install all required dependencies with `npm install`.
The project can then be run with `npm start`. Host/port can be changed with
`PORT=8080 npm start`.

# Docker
This project is also dockerized for more straightforward deployments. The docker
file can be built and run as follows.
```
docker build -t gridlock:latest .
docker run -p 80:80 gridlock:latest
```
