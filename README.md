# gridlock
An agent based traffic simulator web application. Winter 2020 Honors Project

# Running

## Run with NPM
To run locally, first install all required dependencies with `npm install`.
The project can then be run with `npm start`. Host/port can be changed with
`PORT=8080 npm start`.

## Run with Docker
This project is also dockerized for more straightforward deployments. The docker
file can be built and run as follows.
```
docker build -t gridlock:latest .
docker run -p 80:80 gridlock:latest
```

## Run with Kubernetes
Kubernetes can be used as well using the `kustomization.yml` file pushed with
`kubectl` targeting a given k8 environment.

# File Structure
The project is built with typescript with a client and server. The client is located
in the [client](./client) directory and the server is located in the [server](./server)
directory; all shared code is located in [common](./common). 
A few tests are located in [tests](./tests), and the map generation
script is located in [scripts](./scripts). All packaged maps are located in the
[maps](./maps) directory.
