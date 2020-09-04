#!/usr/bin/env node
const fs = require("fs")
const moment = require("moment")

const config = require(process.cwd() + '/config.json');

let pictureUrls = [];
mainLogic()

async function mainLogic(){
    console.log("Started at " + moment().toISOString())
    const resultsDir = 'pictureRun_' + moment().format("HH_mm__DD_MM_YYYY")

    fs.mkdir(resultsDir, { recursive: true }, (err) => {
        if (err) throw err;
    });

    let startDateTime = moment(config.startYear + "-" + config.startMonth + "-" + config.startDay + "T" + config.startHour)

    let endDateTime = moment(config.endYear + "-" + config.endMonth + "-" + config.endDay + "T" + config.endHour)
    let finishedRetrieval = false
    do {
        if(startDateTime.isSameOrAfter(endDateTime)){
            finishedRetrieval = true;
        }else{
            getImageUrl(config.apiKey, startDateTime.toISOString(), resultsDir)
            if(startDateTime.hour >= parseInt(config.endHour)){
                startDateTime.add(1, 'days');
                startDateTime.hour(parseInt(config.startHour));
            }else{
                startDateTime.add( config.imageRetrievalInterval, "seconds")
            }
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    while (!finishedRetrieval)

    try {
        const { parse } = require('json2csv');
        const csv = parse(pictureUrls);
        fs.writeFile(resultsDir + "/pictureUrls.csv", csv, function(err) {
            if(err) {
                return console.log(err);
            }
            console.log("The file was saved!");
        });
    } catch (err) {
        console.error(err);
    }
    await new Promise(resolve => setTimeout(resolve, 6000));
    for (const pictureUrl of pictureUrls) {
        await getImageFromUrl(pictureUrl.url, pictureUrl.timestamp, resultsDir)

    }
    console.log("Finished at " + moment().toISOString())
}


async function getImageUrl(apiKey, timestamp, fileDestination){
    var axios = require('axios');
    const data = JSON.stringify({"timestamp": timestamp});
    var config = {
        method: 'post',
        url: 'https://api.meraki.com/api/v0/networks/N_715509390798488988/cameras/Q2TV-QQV8-3ESF/snapshot',
        headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json',
            'X-Cisco-Meraki-API-Key': apiKey
        },
        data : data
    };

    await axios(config)
        .then(async (response) => {
            if(response.status === 202) {
                console.log(".");
                const responseBody = response.data
                // await new Promise(resolve => setTimeout(resolve, 6000));
                pictureUrls.push({timestamp: timestamp, url: responseBody.url})
                // await getImageFromUrl(responseBody.url, timestamp, fileDestination)
            }else if(response.status === 429){
                await new Promise(resolve => setTimeout(resolve, 3000));
                await getImageUrl(apiKey, timestamp, fileDestination)
            }else{
                console.log("Status code : ", response.status)
            }
        })
        .catch(function (error) {
            console.log(error);
        });
}

async function getImageFromUrl(imageUrl, timestamp, fileDestination){
    const https = require('https');
    const fs = require('fs');


    await https.get(imageUrl, async function(response) {
        if (response.statusCode === 200){
            const file = fs.createWriteStream(fileDestination + "/file_" + timestamp+".jpg");
            response.pipe(file);
        }else if(response.statusCode === 404){
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("Issue with image retrieval for " + timestamp)
            await getImageFromUrl(imageUrl, timestamp, fileDestination)
        }else{
            console.log("Error", response)
        }
    });
}