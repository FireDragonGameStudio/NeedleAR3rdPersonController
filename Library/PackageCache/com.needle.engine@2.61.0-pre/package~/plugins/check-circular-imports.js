import madge from 'madge';
import * as fs from "fs";


// import glob from 'glob';
// glob('dirname/**/*.js', function (err, files) {
//     console.log(files);
// });


const dir = process.cwd();

const ignoreDirectories = [
    "node_modules",
    "dist",
];

// https://github.com/pahen/madge#configuration
const config = {
    baseDir: dir,
    tsConfig: dir + "/tsconfig.json",
    fileExtensions: ['ts', 'json'],
    dependencyFilter: (f) => {
        // console.log(f);
        let include = true;
        if (f.endsWith(".d.ts"))
            include = false;
        else if (ignoreDirectories.some(d => f.includes(d))) {
            // console.log("IGNORE", f);
            include = false;
        }
        // if (include)
        //     console.log(f);
        // return (f.endsWith(".d.ts") || f.includes("node_modules")) ? false : true;
        return include;
    }
}

const path = dir;
console.log("Run at ", path);

const outputDir = dir + "/plugins/test-results";

madge(path, config)

    // .then((res) => res.image(dir +'/plugins/imports.svg'))
    // .then((writtenImagePath) => {
    //     console.log('Image written to ' + writtenImagePath);
    // });
    .then((res) => {
        const circ = res.circular();
        console.log("Finished");
        if (fs.existsSync(outputDir) === false)
            fs.mkdirSync(outputDir);
        const filePath = outputDir + '/circular-dependencies.json';
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
        const json = JSON.stringify(circ, null, 2);
        fs.writeFileSync(filePath, json);
        // print linecount from json
        const lines = json.split(/\r\n|\r|\n/).length;
        console.log("circular.json has " + circ.length + " entries and " + lines + " lines");
    });


    // .then((res) => res.dot())
    // .then((output) => {
    //     console.log(output);
    // });