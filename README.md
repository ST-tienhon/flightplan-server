# flightplan-server

## System Requirements
-Ubuntu 24.04


## Update System
```bash
sudo apt update
sudo apt upgrade -y
```

## Install Node version manager (NVM), Node.js
```bash
sudo apt install curl build-essential -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
nvm install 24
```

## Local Environment (rename .env file)
```bash
mv .env.example .env
Update your .env file with api key.
```

## Running Application (development)
```bash
git clone https://github.com/ST-tienhon/flightplan-server.git
cd flightplan-server
npm install
npm run dev
```

## Docker Run
```bash
docker build -t server .
docker run -d --env-file .env -p 3000:3000 server:latest
```