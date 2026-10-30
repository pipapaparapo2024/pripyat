const fs = require('fs');
const path = require('path');
var async = require('async');

const files = process.argv.slice(2);

let str = process.argv.slice(3)[0].split('/');
let my_file = str[str.length-1];

const lib_name = my_file.substring(0, my_file.length - 3);

let moduleMode = 'CJS';

function getFiles (dirPath, callback) {

    fs.readdir(dirPath, function (err, files) {
        if (err) return callback(err);

        var filePaths = [];
        async.eachSeries(files, function (fileName, eachCallback) {
            var filePath = path.join(dirPath, fileName);

            fs.stat(filePath, function (err, stat) {
                if (err) return eachCallback(err);

                if (stat.isDirectory()) {
                    getFiles(filePath, function (err, subDirFiles) {
                        if (err) return eachCallback(err);

                        filePaths = filePaths.concat(subDirFiles);
                        eachCallback(null);
                    });

                } else {
                    if (stat.isFile() && /\.json$/.test(filePath)) {
                        filePaths.push(filePath);
                    }

                    eachCallback(null);
                }
            });
        }, function (err) {
            callback(err, filePaths);
        });

    });
}



for (let file of files) {
	if (file === '-e') {
		moduleMode = 'ES6';
		continue;
	}
	else if (file === '-c') {
		moduleMode = 'CJS';
		continue;
	}
	if (!path.isAbsolute(file)) {
		file = path.resolve(process.cwd(), file);
	}
	let orig;
	try {
		orig = fs.readFileSync(file, 'utf8');
	}
	catch (e) {
		console.log(e.message);
		continue;
	}
	
	const libSetup = /\(function \(([^)]+)\) {((?:.|[\n\r])+)}\)\(/m.exec(orig);
	/* LIB ARGS (Match 1):
	PIXI, lib
	*/
	/* LIB SETUP (Match 2) (mandatory):

	    var MovieClip = PIXI.animate.MovieClip;
	    var Graphics = PIXI.Graphics;
	    var shapes = PIXI.animate.ShapesCache;

	    var Graphic1 = MovieClip.extend(function (mode) {
	        MovieClip.call(this, { mode: mode, duration: 2, loop: false });
	        var instance1 = new Graphics()
	            .drawCommands(shapes.graphic_singleframe[0]);
	        this.addTimedChild(instance1);
	    });

	    var Graphic2 = MovieClip.extend(function (mode) {
	        MovieClip.call(this, { mode: mode, duration: 2, loop: false });
	        var instance1 = new Graphic1(MovieClip.SYNCHED)
	            .setTransform(-2, -2);
	        this.addTimedChild(instance1);
	    });

	    lib.graphic_singleframe = MovieClip.extend(function () {
	        MovieClip.call(this, {
	            duration: 2,
	            framerate: 24
	        });
	        var instance1 = new Graphic2(MovieClip.SYNCHED)
	            .setTransform(16, 16);
	        this.addTimedChild(instance1);
	    });

	    lib.graphic_singleframe.assets = {
	        "graphic_singleframe": "images/graphic_singleframe.shapes.json"
	    };
	*/
	if (!libSetup) {
		console.log('Unable to parse library setup method from ' + file);
		continue;
	}
	
	const [arg_PIXI, arg_lib] = libSetup[1].split(', ');
	const foundAssets = new RegExp(`${arg_lib}\\.([a-zA-Z_$0-9]+)\\.assets = ({[^}]*});`).exec(orig);
	if (!libSetup) {
		console.log('Unable to parse library assets (and which item is the stage) from ' + file);
		continue;
	}
	const [fullAssetSetup, stageName, assets] = foundAssets;
	
	/* STAGE DATA (optional):
	module.exports = {
	    stage: lib.graphic_singleframe,
	    background: 0xffffff,
	    width: 32,
	    height: 32,
	    framerate: 24,
	    totalFrames: 2,
	    library: lib
	};
	*/
	const stageData = /module\.exports = {([^}]+)};/m.exec(orig);
	let data = `window.data = {
	stage: null,
`;
	if (stageData) {
		data += stageData[1].trim().split(/[\n\r]+/)
			.map(s => s.trim())
			.filter(s => !s.startsWith('stage') && !s.startsWith('library'))
			.map(s => '    ' + s)
			.join('\n') + '\n';
	}
	else {
		data +=
`	background: 0x000000,
	width: 0,
	height: 0,
	framerate: 24,
	totalFrames: 1,
`;
	}
	data +=
`	assets: ${assets},
	lib: {},
	shapes: {},
	textures: {},
	spritesheets: [],
	getTexture: function(id) {
		if (data.textures[id]) {
			return data.textures[id];
		}
		const atlas = data.spritesheets.find(atlas => !!atlas.textures[id]);
		return atlas ? atlas.textures[id] : null;
	},
`;
	let setup = libSetup[2];
	// replace assets setup with stage reference setup
	setup = setup.replace(fullAssetSetup, `data.stage = data.lib.${stageName};`);
	// remove the shapes cache variable, if present
	setup = setup.replace(new RegExp(`^\\s+var shapes = ${arg_PIXI}\\.animate\\.ShapesCache;\\r?\\n?`, 'm'), '');
	// remove the fromFrame variable, if present
	setup = setup.replace(new RegExp(`^\\s+var fromFrame = ${arg_PIXI}\\.Texture\\.fromFrame;\\r?\\n?`, 'm'), '');
	// replace MovieClip variable
	setup = setup.replace(new RegExp(`${arg_PIXI}\\.animate.MovieClip`), 'animate.MovieClip');
	// replace Container variable
	setup = setup.replace(new RegExp(`${arg_PIXI}\\.Container`), 'animate.Container');
	// replace Sprite variable
	setup = setup.replace(new RegExp(`${arg_PIXI}\\.Sprite`), 'animate.Sprite');
	// replace Text variable
	setup = setup.replace(new RegExp(`${arg_PIXI}\\.Text`), 'animate.Text');
	// replace Graphics variable
	setup = setup.replace(new RegExp(`${arg_PIXI}\\.Graphics`), 'animate.Graphics');
	// fix lib usage
	setup = setup.replace(new RegExp(`(\\s)(${arg_lib})(?=\\.)`, 'g'), '$1data.lib');
	// fix shapes usage
	setup = setup.replace(new RegExp(`(\\W)(shapes)(?=\\.)`, 'g'), '$1data.shapes');
	// fix fromFrame usage
	setup = setup.replace(new RegExp(`(\\W)(fromFrame)(?=\\()`, 'g'), '$1data.getTexture');
	// fix MovieClip extension
	const MCFinder = /^([ \t]+)((?:data\.lib\.|var )[a-zA-Z_$0-9]+ = )MovieClip.extend\(function \(([^)]*)\) {/m;
	let found = MCFinder.exec(setup);
	while (found) {
		const [fullMatch, indent, libItem, args] = found;
		const {index} = found;
		// replace extend() with class declaration & constructor
		setup = setup.replace(fullMatch, `${indent}${libItem}class extends MovieClip {
${indent}constructor(${args}) {`);
		// replace super call with real super()
		const superFinder = /MovieClip.call\(this, /;
		superFinder.lastIndex = index;
		setup = setup.replace(superFinder, 'super(');
		// replace the closing of the extend() function with closing of constructor & class
		const endFinder = new RegExp(`^${indent}}\\);`, 'm');
		endFinder.lastIndex = index;
		setup = setup.replace(endFinder, `${indent}}\n${indent}}`);
		// find next
		found = MCFinder.exec(setup);
	}
	// fix Container extension
	const ContainerFinder = /^([ \t]+)((?:data\.lib\.|var )[a-zA-Z_$0-9]+ = )Container.extend\(function \(([^)]*)\) {/m;
	found = ContainerFinder.exec(setup);
	while (found) {
		const [fullMatch, indent, libItem] = found;
		const {index} = found;
		// replace extend() with class declaration & constructor
		setup = setup.replace(fullMatch, `${indent}${libItem}class extends Container {
${indent}constructor() {`);
		// replace super call with real super()
		const superFinder = /Container.call\(this/;
		superFinder.lastIndex = index;
		setup = setup.replace(superFinder, 'super(');
		// replace the closing of the extend() function with closing of constructor & class
		const endFinder = new RegExp(`^${indent}}\\);`, 'm');
		endFinder.lastIndex = index;
		setup = setup.replace(endFinder, `${indent}}\n${indent}}`);
		// find next
		found = ContainerFinder.exec(setup);
	}
	// replace var with const
	setup = setup.replace(/(\s)(var)(?=\s)/g, '$1const');
	
	// now insert setup
	data +=
`	setup: function(animate) {
	${setup}
	}
`;
	
	// close data object
	data += '};\n';
	
	// do export - TODO: ES6 as well
	data += `
${moduleMode === 'CJS' ? 'module.exports =' : lib_name+'.setup(PIXI.animate)'};`;

	data = data.replace(/data/gi, lib_name);
	//data = data.replace(/data/gi, lib_name);

	let startName = my_file.substring(0, my_file.length - 11);
	let shReg = new RegExp(startName+".shapes","gi");
	//let shReg1 = new RegExp(startName+"[","gi");
	//let shReg2 = new RegExp('"'+startName+'": ',"gi");

	let atlasReg = new RegExp(startName+"_atlas","gi");

	data = data.replace(shReg, lib_name+'.shapes');
	//data = data.replace(shReg2, '"'+lib_name+'": ');

	data = data.replace(atlasReg, lib_name+"_atlas");

	fs.writeFileSync(file, data, 'utf8');


	getFiles('./images', function (err, files) {
    	//console.log(err || files);

    	for(let i = 0; i < files.length; i++){
    		let fileContent = fs.readFileSync(files[i], "utf8");

    		fileContent = fileContent.replace(shReg, lib_name+'.shapes');
    		fileContent = fileContent.replace(atlasReg, lib_name+"_atlas");

    		fs.writeFileSync(files[i], fileContent);
    	}
	});
}