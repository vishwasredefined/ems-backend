let logStreamFileName = "recru";
const mongoose = require('mongoose');

const fs = require('fs');
// const logStream = fs.createWriteStream(`./${logStreamFileName}.json`, { flags: 'a' });
// console.log = function (message) {
//     logStream.write(`${message}\n`);
//     process.stdout.write(`${message}\n`);
// };

function mapp() {
    let allCountries = require("./countries");

    let allStates = require("./states").states;
    let allCities = require("./cities");


    let newCities = [];
    for (let i = 0; i < allCities.cities.length; i++) {
        let city = allCities.cities[i];

        let stateId = city.state_id;
        // console.log("Searching for City => ", city)
        let stateSearch = allStates.find(e => e.id == stateId);
        if (stateSearch) {
            // console.log("FOund....", stateSearch);
            newCities.push({
                ...city,
                country_id: stateSearch.country_id
            })
            // console.log({
            //     ...city,
            //     countryId: stateSearch.country_id
            // })
        }else{
            newCities.push({
                ...city,
                // countryId: stateSearch.country_id
            })
        }
    }
    console.log("newCities => ", newCities)

    fs.writeFileSync("./p.json", JSON.stringify(newCities), "utf-8")
}
mapp()