# SAT Autoscorer
Automatically reads and scores an annotated SAT answer sheet PDF. This is intended for use with the [official paper SAT answer sheet](https://satsuite.collegeboard.org/media/pdf/sat-practice-answer-sheet.pdf). This program analyzes an answer sheet as a 1D array of pixel color data and determines where an answer has been bubbled in.

## Usage
To use, first ensure that you are using Node.js v18 or higher. Then you can clone this repo, run `npm i`, and run the following command:
```
node index.js <path to annotated answer sheet pdf> [path to answer key json] [debug]
```
An annotated PDF named `sample.pdf` has been provided in this repo. This is the only required argument. **Please ensure that you are using black ink when digitally marking up the document, and that your document editor does not resize the PDF at all.**

If you provide the path to a JSON file containing the answers to the exam (format will be discussed later), the program will automatically score your answer sheet and provide a potential SAT score based on real curves that were used in the past (sourced from https://thecollegepanda.com).

Example command: `node index.js sample.pdf data/answer_keys/practice-test-1.json`:

<img src="https://github.com/shrayus-masanam/SAT-Autoscorer/assets/45981228/8b9642b8-d72f-44ef-921d-c798281bcff3" height=500>

If you don't provide an answer key, the program will just display the values that it read from the answer sheet.

Example command: `node index.js sample.pdf`:

<img src="https://github.com/shrayus-masanam/SAT-Autoscorer/assets/45981228/e7fe5b99-943e-4acc-a722-40d13abad237" height=500>

The `debug` argument generates files that let you view which pixels the program analyzes to determine the answer choice that you selected. This will create a new folder named `debug` in the working directory.

Example command: `node index.js sample.pdf debug`:

<img src="https://github.com/shrayus-masanam/SAT-Autoscorer/assets/45981228/d41ccb7b-432e-4198-af7a-21eb26675005" height=500>

## Answer key format
An answer key JSON file contains a single dimensional array with strings representing the correct answer to all the questions on the exam, in order of appearance (the first 52 elements of the array are multiple-choice answers to the reading section, the next 44 for the writing section, etc). 

The math sections on the SAT include free response questions, and sometimes there are multiple accepted answers. If this is the case, then all answers should be in the same string but separated by `||`, which acts as a delimiter. See the included `practice-test-1.json` file for an example. 

Additionally, you won't have to worry about covering equivalent forms of answers. This program uses `mathjs` to evaluate all FRQs so that fractional and decimal representations of the same numerical value are treated equally.

<hr>

SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this repository.
