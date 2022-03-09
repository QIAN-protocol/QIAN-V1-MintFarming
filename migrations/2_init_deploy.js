var path = require("path");
var fs = require("fs");
var mkdirp = require("mkdirp");

module.exports = async function (deployer, network) {
    network = /([a-z]+)(-fork)?/.exec(network)[1];

    var output = path.join(path.dirname(__dirname), "output");
    if (!fs.existsSync(output)) mkdirp.sync(output);
    
    var networkfile = path.join(output, "@network");
    if (fs.existsSync(networkfile)) fs.unlinkSync(networkfile);
    fs.writeFileSync(networkfile, network);

    var logfile = path.join(output, "migration." + network + ".log");
    if (fs.existsSync(logfile)) fs.unlinkSync(logfile);
    
    var addresses = path.join(output, "addresses." + network + ".txt");
    if (fs.existsSync(addresses)) fs.unlinkSync(addresses);
};
