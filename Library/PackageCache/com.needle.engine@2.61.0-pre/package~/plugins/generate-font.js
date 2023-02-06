import generateBMFont from 'msdf-bmfont-xml';
import fs from 'fs';
import path from 'path';

const args = process.argv;

const fontPath = args[2];
const outputDir = args[3];
const charsetPath = args.length > 4 ? args[4] : null;

if (!fontPath || !fs.existsSync(fontPath)) {
    console.error("Missing font path. Please call this script with a path to a font file. Called with: \"" + fontPath + "\"");
    process.exit(1);
}
if (!outputDir || !fs.existsSync(outputDir)) {
    console.error("Missing output directory, please provide an output directory as the second argument. Called with: \"" + outputDir + "\"");
    process.exit(1);
}

// https://soimy.github.io/msdf-bmfont-xml/#module-usage-examples


let message = "Generate font texture " + fontPath + " to " + outputDir;

let charset = null;
if (charsetPath && fs.existsSync(charsetPath)) {
    message += " using chars from \"" + charsetPath + "\"";
    charset = fs.readFileSync(charsetPath, 'utf8');
    console.log("charset: ", charset);
    if (charset.length <= 0) {
        console.warn("WARN: Charset file is empty, using default charset");
        charset = null;
    }
}

console.log(message);
const opts = {
    outputType: "json",
    fieldType: "msdf",
    textureSize: [4096, 4096],
    smartSize: true, // shrink atlas to the smallest possible square
    // rtl: true, // use RTL(Arabic/Persian) charators fix
};
if (charset?.length)
    opts.charset = charset;

generateBMFont(fontPath, opts,
    (error, textures, font) => {
        if (error) throw error;
        textures.forEach((texture, index) => {
            const fileName = path.parse(texture.filename).name.toLocaleLowerCase() + ".png";
            const outputPath = outputDir + "/" + fileName;
            console.log("Write to", outputPath);
            if (index > 0) console.log("WARN: Multiple font textures generated but they will override each other. You have currently " + charset?.length + " characters configured. Maybe too many?");
            fs.writeFile(outputPath, texture.texture, (err) => {
                if (err) throw err;
            });
        });

        const fileName = path.parse(font.filename).name;
        const name = outputDir + "/" + fileName.toLocaleLowerCase() + "-msdf.json";
        fs.writeFile(name, font.data, (err) => {
            if (err) throw err;
        });
    });