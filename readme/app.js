const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();
var Airtable = require('airtable');
const { exit } = require("process");
var base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);

let filename = "README.md"
let readmecontent = "";
let categories = []
//fetch head of readme
base('README').select({
    view: "Grid view",
    filterByFormula: "Name='GithubAbout'"
}).eachPage(function page(records, fetchNextPage) {
    // add head content
    records.forEach(function(record) {
        readmecontent += record.get('Notes')
    });
    fetchNextPage();
}, function done(err) {
    if (err) { console.error(err); return; }

    // fetch categories
    base('Categories').select({
        view: 'Grid view'
    }).firstPage(async function(err, records) {
        if (err) { console.error(err); return; }
        records.forEach(function(record) {
            // add categories to a list for function below
            categories.push(record.get('Category'));
        });
        for (const category of categories){
            // check if category has records.
            if(await check(category))
            {console.log("Skipping ", category)}
            else{
            readmecontent += `### ${category}\n`
            readmecontent += `| Provider | Description | Size | HQ | Alternative to |\n`
            readmecontent += `| --- | --- | --- | --- | --- |\n`
            
            await awesome(category);
            }
        };
            fs.writeFileSync(filename, readmecontent);
            console.log("wrote to", filename)
    });
}); 
async function awesome(category){
    return new Promise(function(resolve, reject) {
    let searchcategory = "Categories='"+ category + "'"
    base('Awesome Aussies').select({
        view: "Awesome Aussie",
        filterByFormula: searchcategory,
    }).eachPage(function page(records, fetchNextPage) {
        // This function (`page`) will get called for each page of records.
        records.forEach(function(record) {
            console.log(category)
            console.log('Adding ', record.get('Provider'));
            readmecontent += `| [${record.get('Provider')}](${record.get('URL')}) | ${record.get('Description')} | ${record.get('Size')} | ${record.get('HQ')} | ${record.get('Alternative to')} |\n`;
        });
        fetchNextPage();

    }, function done(err) {
        if (err) {
             console.error(err);
        }
        resolve()
        return true;
    });
})
}
async function check(category){
    return new Promise(function(resolve, reject) {
    let searchcategory = "Categories='"+ category + "'"
    base('Awesome Aussies').select({
        view: "Awesome Aussie",
        filterByFormula: searchcategory,
    }).eachPage(function page(records) {
        let resp = records.length  
        console.log(records.length)
        // if there aren't any records move exit for next category
        if(resp <1){
            resolve(1);
        }
        else{
            resolve(0);
        }
    }, function done(err) {
        if (err) {
             console.error(err);
        }
        resolve()
        return true;
    });
})
}