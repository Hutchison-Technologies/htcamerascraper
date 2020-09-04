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
    console.log("Calculating timestamps")
    const allTimestamps = getAllTimes(startDateTime, endDateTime);
    let batchindex = 0;
    let batchValue = 100;
    let batchImages = []
    for (let i = 0; i < allTimestamps.length; i++) {
        const allTimestamp = allTimestamps[i];
        await getImageUrl(config.apiKey, allTimestamp, resultsDir, batchImages)
        if(batchindex >= batchValue || i === allTimestamps.length - 1){
            await new Promise(resolve => setTimeout(resolve, 6000));
            for (const pictureUrl of batchImages) {
                await getImageFromUrl(pictureUrl.url, pictureUrl.timestamp, resultsDir)
            }
            batchindex = 0
            batchImages = []
            // await new Promise(resolve => setTimeout(resolve, 5000));
        }else{
            batchindex++;
        }
        // await new Promise(resolve => setTimeout(resolve, 3500));
    }
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
    console.log("Finished at " + moment().toISOString())
}

function getAllTimes(timestampStart, timestampEnd){
    let currentTimestamp = timestampStart
    let allTimes = []
    allTimes.push(currentTimestamp.toISOString())
    let finishedRetrieval = false
    do {
        if(timestampStart.isSameOrAfter(timestampEnd)){
            finishedRetrieval = true;
        }else{
            if(timestampStart.hour >= parseInt(config.endHour)){
                currentTimestamp.add(1, 'days');
                currentTimestamp.hour(parseInt(config.startHour));
                allTimes.push(currentTimestamp.toISOString())
            }else{
                currentTimestamp.add( config.imageRetrievalInterval, "seconds")
                allTimes.push(currentTimestamp.toISOString())
            }
        }
    }
    while (!finishedRetrieval)
    return allTimes;
}

async function getImageUrl(apiKey, timestamp, fileDestination, batchImages){
    const axios = require('axios');
    let data = JSON.stringify({"timestamp": timestamp});
    let config = {
        method: 'post',
        url: 'https://api.meraki.com/api/v0/networks/N_715509390798488988/cameras/Q2TV-QQV8-3ESF/snapshot',
        headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json',
            'X-Cisco-Meraki-API-Key': apiKey
        },
        data: data
    };

    await axios(config)
        .then(async (response) => {
            if(response.status === 202) {
                // console.log("Got url for " + timestamp);
                const responseBody = response.data
                // await new Promise(resolve => setTimeout(resolve, 6000));
                pictureUrls.push({timestamp: timestamp, url: responseBody.url})
                batchImages.push({timestamp: timestamp, url: responseBody.url})
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
            console.log("Saving Image for " + timestamp)
            console.log(response.statusMessage)
            const file = fs.createWriteStream(fileDestination + "/file_" + timestamp+".jpg");
            response.pipe(file);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }else if(response.statusCode === 404){
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("Issue with image retrieval for " + timestamp)
            await getImageFromUrl(imageUrl, timestamp, fileDestination)
        }else{
            console.log("Error", response)
        }
    });
}