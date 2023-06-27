const {pdfToPng} = require('pdf-to-png-converter');
const fs = require('fs');
const path = require('path');
const PNG = require('png-js');
const Jimp = require('jimp');
const math = require('mathjs');

let args = process.argv;
args.shift(); // remove node path
args.shift(); // remove program path
let debug = args.includes("debug");
if (debug) args.splice(args.indexOf("debug"), 1);
let pdfFilePath = args[0];
if (!pdfFilePath) {
    console.log("Usage: node index.js <path to annotated answer sheet pdf> [path to answer key json] [debug]");
    process.exit(1);
}
let answerKey = args[1] ? JSON.parse(fs.readFileSync(args[1])) : null;
const curveData = answerKey && JSON.parse(fs.readFileSync(path.join("data/", "curves.json")));
let incorrectCount = {
    reading: 0,
    writing: 0,
    math: 0,
    unmodified: true
};

// https://stackoverflow.com/a/20762713
function mode(arr) {
    return arr.sort((a, b) =>
        arr.filter(v => v === a).length -
        arr.filter(v => v === b).length
    ).pop();
}


async function main() {
	let pngs = await pdfToPng(pdfFilePath, {viewportScale: 2.5});

    function get1dIndex(x, y, width = Math.floor(pngs[0].width)) {
        return (y * width + x) * 4;
    }

    function get2dCoords(index, width = Math.floor(pngs[0].width)) {
        let y = Math.floor(index / (width * 4));
        let x = Math.floor((index - (y * width * 4)) / 4);
        return [x, y];
    }

    function getResponseForQuestion(pixel) {
        // pixel is the 1d index of a pixel inside of the A bubble
        for (let i = 0; i < 4; i++) {
            markDebugPixel(pixel + 28 * i * 4);
            if (pixels[pixel + 28 * i * 4] == 0)
                return String.fromCharCode('A'.charCodeAt(0) + i); // A, B, C, D
        }
        return 'Omitted';
    }

    function getResponseForGridIn(pixel) {
        // 'pixel' is the 1d location of a pixel within the first bubble of the grid-in box. The first bubble is the one with the "/" in it, but it's not actually on the document for the first grid-in box. We just treat it as though it does exist.
        let response = "";
        for (let i = 0; i < 4; i++) { // 4 times, 1 for each grid-in box. i moves the cursor horizontally.
            //console.log("Box #" + (i+1));
            for (let j = -2; j <= 9; j++) { // checking every bubble. j moves the cursor vertically.
                let pos = pixel + (i * 28 * 4) + ((j + 2) * 21 * Math.floor(pngs[0].width) * 4); // 28 pixels space between boxes, 23 pixels space between bubbles. Multiplying by 4 is done because the array is 1d and each pixel has r,g,b,a values.
                markDebugPixel(pos);
                if (pixels[pos] == 0) {
                    switch (j) {
                        case -2:
                            response += "/";
                            break;
                        case -1:
                            response += ".";
                            break;
                        default:
                            response += j;
                    }
                    break; // move onto the next grid-in box
                }
            }
        }
        response = response.trim();
        if (response == "") response = "Omitted";
        return response;
    }

    function markDebugPixel(pos, color=[0, 255, 0, 255]) {
        if (!debug) return;
        debug_pixels[pos] = color[0];
        debug_pixels[pos + 1] = color[1];
        debug_pixels[pos + 2] = color[2];
        debug_pixels[pos + 3] = color[3];
    }

    function saveDebugPixels(name) {
        if (!debug) return;
        let debugFolder = path.join(__dirname, "debug");
        if (!fs.existsSync(debugFolder)) fs.mkdirSync(debugFolder);
        let image = new Jimp(pngs[0].width, pngs[0].height);
        for (let i = 0; i < debug_pixels.length; i += 4) {
            let coords = get2dCoords(i);
            image.setPixelColor(Jimp.rgbaToInt(debug_pixels[i], debug_pixels[i+1], debug_pixels[i+2], debug_pixels[i+3]), coords[0], coords[1]);
        }
        image.write(path.join(debugFolder, `${name}.png`));
    }

    let pixels;
    let debug_pixels;
    let readingSection = {}, writingSection = {}, mathNoCalcSection = {}, mathCalcSection = {};
    let started = new Date();
    new PNG(pngs[0].content).decode(function(p) {
        pixels = p;
        debug_pixels = [...p];

        // Reading section
        for (let i = 1; i <= 52; i++) {
            let x = 305;
            let y = 273 - 21;
            let colOffset = Math.floor(i / 11.01) * 228;
            let rowOffset = (i % 11 != 0 ? i % 11 : 11) * 21;
            
            readingSection[i] = getResponseForQuestion(get1dIndex(x + colOffset, y + rowOffset));
            markDebugPixel(get1dIndex(x + colOffset, y + rowOffset));
        }

        // Writing section
        for (let i = 1; i <= 44; i++) {
            let x = 305;
            let y = 594 - 21;
            let colOffset = Math.floor(i / 9.01) * 228;
            let rowOffset = (i % 9 != 0 ? i % 9 : 9) * 21;
            writingSection[i] = getResponseForQuestion(get1dIndex(x + colOffset, y + rowOffset));
            markDebugPixel(get1dIndex(x + colOffset, y + rowOffset));
        }

        // Math No Calculator section
        // MCQs
        for (let i = 1; i <= 15; i++) {
            let x = 305;
            let y = 872 - 21;
            let colOffset = Math.floor(i / 15.01) * 228;
            let rowOffset = (i % 15 != 0 ? i % 15 : 15) * 21;
            mathNoCalcSection[i] = getResponseForQuestion(get1dIndex(x + colOffset, y + rowOffset));
            markDebugPixel(get1dIndex(x + colOffset, y + rowOffset));
        }
        // Grid-in/FRQs
        for (let i = 16; i <= 20; i++) {
            let x = 530;
            let y = 959;
            let rowOffset = ((i - 15 - 1) % 3) * 228;
            let colOffset = Math.floor((i - 15) / 3.01) * 343;
            //console.log("reading ", x + rowOffset, y + colOffset, "aka question #" + i)
            mathNoCalcSection[i] = getResponseForGridIn(get1dIndex(x + rowOffset, y + colOffset));
            markDebugPixel(get1dIndex(x + rowOffset, y + colOffset));
        }

        // checking scores
        function checkFRQ(answer, response) {
            if (response == '') return false;
            if (response.includes("/")) response = math.fraction(response);
            let found = false;
            answer.split("||").forEach((ans) => {
                try {
                ans = ans.trim();
                if (ans == '') return;
                if (ans.includes("/")) ans = math.fraction(ans);
                if (math.equal(ans, response)) found = true;
                } catch (e) {}
            });
            return found;
        }
        // reading starts at 0, writing starts at 52, math no calc MCQ starts at 96, math no calc FRQ starts at 111, math calc starts at 116, math calc FRQ starts at 146
        if (answerKey) {
            for (let i = 0; i < 52; i++) {
                if (answerKey[i] == readingSection[i + 1]) {
                    readingSection[i + 1] += " ✅";
                } else {
                    readingSection[i + 1] += " ❌";
                    incorrectCount["reading"]++;
                }
            }
            for (let i = 0; i < 44; i++) {
                if (answerKey[52 + i] == writingSection[i + 1]) {
                    writingSection[i + 1] += " ✅";
                } else {
                    writingSection[i + 1] += " ❌";
                    incorrectCount["writing"]++;
                }
            }
            // problem todo
            for (let i = 0; i < 15; i++) {
                if (answerKey[52 + 44 + i] == mathNoCalcSection[i + 1]) {
                    mathNoCalcSection[i + 1] += " ✅";
                } else {
                    mathNoCalcSection[i + 1] += " ❌";
                    incorrectCount["math"]++;
                }
            }
            for (let i = 0; i < 5; i++) {
                if (checkFRQ(answerKey[52 + 44 + 15 + i], mathNoCalcSection[i + 15 + 1])) {
                    mathNoCalcSection[i + 15 + 1] += " ✅";
                } else {
                    mathNoCalcSection[i + 15 + 1] += " ❌";
                    incorrectCount["math"]++;
                }
            }
        }

        console.log("Reading section");
        console.table(readingSection);
        console.log("Writing section");
        console.table(writingSection);
        console.log("Math No Calculator section");
        console.table(mathNoCalcSection);
        saveDebugPixels("page_1_" + started.getTime());

        // second page needs to be decoded synchronously so it's done in the callback of the first page
        new PNG(pngs[1].content).decode(function (p) {
            pixels = p;
            debug_pixels = [...p];
            // Math Calculator section
            // MCQs
            for (let i = 1; i <= 30; i++) {
                let x = 321;
                let y = 264 - 21;
                let colOffset = Math.floor(i / 30.01) * 228;
                let rowOffset = Math.floor(((i % 30.01) * 21.5) + 0.5); // rounded to nearest pixel
                mathCalcSection[i] = getResponseForQuestion(get1dIndex(x + colOffset, y + rowOffset));
                markDebugPixel(get1dIndex(x + colOffset, y + rowOffset));
            }
            // Grid-in/FRQs
            for (let i = 31; i <= 38; i++) {
                let x = 544;
                let y = 350;
                let rowOffset = Math.floor((((i - 30 - 1) % 4) * 228.5) + 0.5); // rounded to nearest pixel
                let colOffset = Math.floor((i - 30) / 4.01) * 323;
                //console.log("reading ", x + rowOffset, y + colOffset, "aka question #" + i)
                mathCalcSection[i] = getResponseForGridIn(get1dIndex(x + rowOffset, y + colOffset));
                markDebugPixel(get1dIndex(x + rowOffset, y + colOffset));
            }

            // checking scores
            if (answerKey) {
                for (let i = 0; i < 30; i++) {
                    if (answerKey[52 + 44 + 20 + i] == mathCalcSection[i + 1]) {
                        mathCalcSection[i + 1] += " ✅";
                    } else {
                        mathCalcSection[i + 1] += " ❌";
                        incorrectCount["math"]++;
                    }
                }
                for (let i = 0; i < 8; i++) {
                    if (checkFRQ(answerKey[52 + 44 + 20 + 30 + i], mathCalcSection[i + 30 + 1])) {
                        mathCalcSection[i + 30 + 1] += " ✅";
                    } else {
                        mathCalcSection[i + 30 + 1] += " ❌";
                        incorrectCount["math"]++;
                    }
                }
            }
            console.log("Math Calculator section");
            console.table(mathCalcSection);
            if (answerKey) {
                console.log("📋 Performance: -" + incorrectCount["reading"] + "R " + "-" + incorrectCount["writing"] + "W " + "-" + incorrectCount["math"] + "M");
                let possibleReadingScores = [];
                let possibleWritingScores = [];
                let possibleMathScores = [];
                curveData[1].Reading.forEach(curve => possibleReadingScores.push(curve.curve[52-incorrectCount["reading"]]));
                curveData[1].Writing.forEach(curve => possibleWritingScores.push(curve.curve[44-incorrectCount["writing"]]));
                curveData[1].Math.forEach(curve => possibleMathScores.push(curve.curve[58-incorrectCount["math"]]));
                let possibleEVBRWScore = (mode(possibleReadingScores) + mode(possibleWritingScores)) * 10;
                let possibleMathScore = mode(possibleMathScores);
                console.log(`🏆 Possible exam score: ${possibleEVBRWScore + possibleMathScore} (${possibleEVBRWScore} EVBRW, ${possibleMathScore} Math)`)
            }

            saveDebugPixels("page_2_" + started.getTime());
        });
    });
}
main();