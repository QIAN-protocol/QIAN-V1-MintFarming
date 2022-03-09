var path = require("path");
var fs = require("fs");

function DeployHelper() {
    this.output = path.join(path.dirname(__dirname), "output");
    this.network = fs.readFileSync(path.join(this.output, "@network"));
    this.deployenv = require(path.join(path.dirname(__dirname), "deployenv-" + this.network + ".json"));
    this.logger = fs.createWriteStream(path.join(this.output, "migration." + this.network + ".log"), { flags: "a" });
    this.exporter = fs.createWriteStream(path.join(this.output, "addresses." + this.network + ".txt"), { flags: "a" })
}

module.exports = new DeployHelper();
