const fs = require('fs');

let str = process.argv.slice(3)[0].split('/');
let my_file = str[str.length - 1];

const lib_name = my_file.substring(0, my_file.length - 3);

//console.log(files);



fs.readFile(my_file, 'utf8', (err, data) => {
    //if (err) throw err;

    data = data.replace(/export default data;/gi, '');
    data = data.replace(/const data/gi, 'window.' + lib_name);
    data = data.replace(/data./gi, lib_name+'.');

    //console.log(data);

    fs.writeFileSync(my_file, data, 'utf8');
});