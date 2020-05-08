# xwordinfo-json-to-pdf
Render crossword puzzles in the [xwordinfo.com JSON](https://www.xwordinfo.com/JSON/) format into pretty, printable PDFs.

## Usage
Clone the repo,
```sh
git clone https://github.com/marvinklein/xwordinfo-json-to-pdf.git
cd xwordinfo-json-to-pdf
```
Install dependencies,
```sh
npm install
```
Then,

```sh
node index.js input-file-name.json output-file-name.pdf
```


## Enhancements
Improve the layout algorithm:
- Automatically adjust font size for puzzles with very few or many clues
- Prevent orphaned clues and awkward flow of "across" and "down" section titles