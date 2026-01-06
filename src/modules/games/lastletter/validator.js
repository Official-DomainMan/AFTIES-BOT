function isValidWord(word) {
  return /^[a-zA-Z]+$/.test(word);
}

function getLastLetter(word) {
  return word[word.length - 1].toLowerCase();
}

module.exports = { isValidWord, getLastLetter };
