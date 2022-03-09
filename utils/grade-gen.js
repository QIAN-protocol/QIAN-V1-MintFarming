var web3 = require("web3");

function gen() {
    for (let i = 0; i < 9; ++i) {
        console.log("GRADE-" + i + ": " + web3.utils.keccak256("GRADE-" + i));
    }
}
gen();
