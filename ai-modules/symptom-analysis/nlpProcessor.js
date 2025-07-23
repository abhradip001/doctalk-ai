const natural = require('natural');
const { WordTokenizer, PorterStemmer } = natural;
const tfidf = new natural.TfIdf();
const classifier = new natural.BayesClassifier(PorterStemmer);

// Pre-trained medical terms and their associations
const MEDICAL_TERMS = {
  'headache': ['migraine', 'tension', 'cluster'],
  'fever': ['infection', 'flu', 'covid'],
  'cough': ['cold', 'flu', 'pneumonia'],
  'pain': ['chest', 'abdominal', 'joint']
};

// Training data for the classifier
const TRAINING_DATA = [
  { text: "I have a headache and fever", label: "flu" },
  { text: "My head hurts and I feel hot", label: "flu" },
  { text: "Coughing and difficulty breathing", label: "respiratory" },
  { text: "Stomach pain and diarrhea", label: "digestive" },
  { text: "Joint pain and swelling", label: "arthritis" }
];

// Train the classifier
TRAINING_DATA.forEach(data => classifier.addDocument(data.text, data.label));
classifier.train();

module.exports = {
  processInput: (text) => {
    // Tokenize and stem the input
    const tokenizer = new WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const stemmedTokens = tokens.map(token => PorterStemmer.stem(token));
    
    // Extract key symptoms
    const symptoms = [];
    stemmedTokens.forEach(token => {
      if (MEDICAL_TERMS[token]) {
        symptoms.push(token);
        MEDICAL_TERMS[token].forEach(related => symptoms.push(related));
      }
    });
    
    // Classify the input
    const classification = classifier.classify(text);
    
    // Calculate TF-IDF for important terms
    const importantTerms = [];
    tfidf.addDocument(text);
    tfidf.listTerms(0).forEach(item => {
      if (item.tfidf > 0.2) {
        importantTerms.push(item.term);
      }
    });
    
    return {
      tokens: stemmedTokens,
      symptoms: [...new Set(symptoms)], // Remove duplicates
      classification,
      importantTerms
    };
  }
};