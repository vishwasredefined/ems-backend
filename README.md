## EMS

## Description

This portal is for Event management system.

## Prerequisites

Make sure you have installed all of the following prerequisites on your development machine:
Git - Download & Install Git. OSX and Linux machines typically have this already installed.
Version 2.33.0.
Node.js - Download & Install Node.js and the npm package manager. If you encounter any problems, you can also use this GitHub Gist to install Node.js.
Version 14.17.6
MongoDB - Download & Install MongoDB, and make sure it's running on the default port (27017)
Version MongoDB 4.4

## Version 1.0.2

View Previous Versions [linky](./VERSIONS.md)

## Get Started

Get started developing...

shell

# clone backend in your local system

git clone git@bitbucket.org:4321r/ems-backend.git

#Latest branch
git checkout new-features

# install deps

npm install

# run in development mode

npm start

## Install Dependencies

Install all package dependencies (one time operation)

shell
npm install

## Insert Seed data

Insert predefined seed data (one time operation)

shell
npm run seeds
node ./seeds/seedSkill.js

## Run It

#### Run in development mode:

Runs the application is development mode. Should not be used in production

shell
npm start

#### Run in production mode:

Compiles the application and starts it in production production mode.

shell
NODE_ENV=production npm start

## Documentation

- For system on local, Open you're browser to [http://localhost:3000](http://localhost:3000) 
- Open you're browser to [https://dev-api.femzi.in/](https://dev-api.femzi.in/)
- Run api described in swagger doc
- Invoke the `/api` endpoint
  shell
  curl https://dev-api.femzi.in/

## Config

- find all pre-dependencies in config folder
- Change the Following domain settings as per requirements
  CLIENT_URL
  EMAIL_HOST
  IMAGE_PATH

## Authors

- ITH Technologies
