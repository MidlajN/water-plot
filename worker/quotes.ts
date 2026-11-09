const quotes = [
    "Great things are done by a series of small things brought together.",
    "The secret of getting ahead is getting started.",
    "It always seems impossible until it is done.",
    "Simplicity is the ultimate sophistication.",
    "Make each day your masterpiece.",
    "Stay curious. Keep creating.",
    "Well done is better than well said.",
    "Small steps every day lead to big results.",
];

export function getRandomQuote() {
    return quotes[Math.floor(Math.random() * quotes.length)];
}