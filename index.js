/* eslint no-magic-numbers: [ 'error', { ignore: [ 0, 1, 2, 3, 4 ] } ] */

const fs = require('fs');
const path = require('path');

const decode = require('unescape');
const dateFormat = require('dateformat');
const PDFDocument = require('pdfkit');

// page layout
const pageSize = { width: 612.00, height: 792.00 }; // US Letter in PDF units of 72ppi
const margins = { top: 54, left: 72, bottom: 72, right: 72 };

// column layout
const numColumns = 5;
const columnGap = 25;
const columnWidth = n => (n * ((pageSize.width - margins.left - margins.right - (columnGap * (numColumns - 1))) / numColumns)) + ((n - 1) * columnGap);

// grid
const gridwidth = 3; // width of the grid in columns

// text styles
const titleOpts = { font: 'Times-Bold', fontSize: 13 };
const subtitleOpts = { font: 'Times-Bold', fontSize: 11 };
const sectionTitleOpts = { font: 'Helvetica-Bold', fontSize: 7, paragraphGap: 3 };
const clueOpts = { font: 'Helvetica', fontSize: 8, paragraphGap: 2, lineGap: 0 };
const clueNumOpts = { font: 'Helvetica-Bold', fontSize: 7 };
const gridNumOpts = { font: 'Helvetica', fontSize: 6 };

// process command line args, create the output file
const argvInputFilename = process.argv[2];
const data = JSON.parse(fs.readFileSync(argvInputFilename));

const argvOutputFilename = process.argv[3];
const doc = new PDFDocument({ margin: 0 });
const outputPath = path.join(process.cwd(), argvOutputFilename);
fs.mkdirSync(path.dirname(outputPath), { recursive: true }); // ensure the target dir exists
doc.pipe(fs.createWriteStream(outputPath));

const size = columnWidth(gridwidth) / data.size.cols;
const gridheight = size * data.size.rows;

var currentcol = 0;

// convenience wrapper to doc.text with additional font options
const writeStr = (str, x, y, opts = {}) => {
  if (opts.font) {
    doc.font(opts.font);
  }
  if (opts.fontSize) {
    doc.fontSize(opts.fontSize);
  }
  doc.text(str, x, y, opts);
};

// write header with title
(() => {
  const marginBottom = 20;
  doc.y = margins.top;
  if (data.hastitle) {
    writeStr(data.title, margins.left, doc.y, titleOpts);
  }
  writeStr(`${data.publisher} — ${dateFormat(data.date, 'fullDate')}`, margins.left, doc.y, subtitleOpts);
  doc.moveTo(margins.left, doc.y)
    .lineTo(pageSize.width - margins.left, doc.y)
    .stroke();
  doc.y = doc.y + marginBottom;
})();

// todo: encapsulte this with the layout logic
// const flowText = (str, x, y, container, opts = {}) => {
//   text(str, x, y, { ...opts, width: container.width });
// };
const columnBounds = [
  { x: margins.left, y: doc.y, y2: pageSize.height - margins.bottom },
  { x: margins.left + columnWidth(1) + columnGap, y: doc.y, y2: pageSize.height - margins.bottom },
  { x: margins.left + columnWidth(2) + columnGap, y: doc.y + gridheight + columnGap, y2: pageSize.height - margins.bottom },
  { x: margins.left + columnWidth(3) + columnGap, y: doc.y + gridheight + columnGap, y2: pageSize.height - margins.bottom },
  { x: margins.left + columnWidth(4) + columnGap, y: doc.y + gridheight + columnGap, y2: pageSize.height - margins.bottom }
];

// calculates {x,y} coords for the input str
// taking into account the layout flow down the columns
const textXY = (str, opts = {}) => {
  var y = doc.y;
  if (!columnBounds[currentcol]) {
    return { x: 0, y: 0, a: [ 0, 0 ] };
  }
  if (doc.y + doc.heightOfString(str, opts) > columnBounds[currentcol].y2) {
    currentcol = currentcol + 1;
    if (!columnBounds[currentcol]) {
      return { x: 0, y: 0, a: [ 0, 0 ] };
    }
    y = columnBounds[currentcol].y;
  }
  return { x: columnBounds[currentcol].x, y, a: [ columnBounds[currentcol].x, y ] };
};

// draw the grid
(() => {
  const pos = { x: pageSize.width - columnWidth(gridwidth) - margins.right, y: doc.y };
  const padding = 2;
  const stroke = 0.5;
  doc.lineWidth(stroke);
  data.grid.forEach((v, i) => {
    const row = ~~(i / data.size.cols);
    const col = i % data.size.cols;
    doc.rect(pos.x + (col * size), pos.y + (row * size), size, size);
    if (v === '.') {
      doc.fillColor('black').fillAndStroke();
    }
    else {
      doc.stroke();
    }
    if (data.circles && data.circles[i]) {
      doc
        .circle(pos.x + (col * size) + (size / 2), pos.y + (row * size) + (size / 2), (size / 2) - stroke)
        .stroke();
    }
    if (data.gridnums[i]) {
      doc
        .fillColor('white')
        .rect(pos.x + (col * size) + (stroke / 2), pos.y + (row * size) + (stroke / 2), size / 2, size / 2)
        .fill();
      doc.fillColor('black');
      writeStr(data.gridnums[i], pos.x + (col * size) + padding, pos.y + (row * size) + padding, gridNumOpts);
    }
  });
})();

// write the clues
(() => {
  const numWidth = 13; // width of the clue numbers // todo: calculate dynamically based on the longest one
  doc.y = columnBounds[currentcol].y;
  [ 'across', 'down' ].forEach(d => {
    writeStr(d.toUpperCase(), ...textXY(d.toUpperCase()).a, sectionTitleOpts);
    data.clues[d].forEach(c => {
      const decoded = decode(c);
      const sep = '. ';
      const num = decoded.substr(0, decoded.indexOf(sep));
      const text = decoded.substr(num.length + sep.length);
      const pos = textXY(text, { width: columnWidth(1) - numWidth });
      writeStr(num, ...pos.a, { ...clueNumOpts, width: numWidth });
      writeStr(text, pos.x + numWidth, pos.y, { ...clueOpts, width: columnWidth(1) - numWidth });
    });
    doc.moveDown(1);
  });
})();

// finalize the PDF and end the stream
doc.end();
