export function formatWeatherDescription(description) {
  const normalizers = [
    {to: '&', from: ['And']},
    {to: '', from: ['Increasing', 'Becoming', 'Decreasing', 'Gradual', 'Patchy', 'Areas Of', 'Freezing']},
    {to: 'Heavy', from: ['Widespread']},
    {to: 'Light', from: ['Lt ', 'Very Light', 'Slight Chance', 'Slight Light', 'Slight Chance Light', 'Chance', 'Isolated', 'Scattered', 'Chance Light', 'Periods Of Light', 'Slight Chance Very Light', 'Intermittent Light', 'Chance Very Light', 'Intermittent']},
    {to: 'Rain', from: ['Rain Showers', 'Spray', 'Rain Fog', 'Showers']},
    {to: 'Snow', from: ['Snow Showers', 'Wintry Mix', 'Flurries']},
    {to: 'Storm', from: ['Thunderstorms', 'T-storms']}
  ];

  // Maximum length for the forecast description (leaving room for day/temp/emoji)
  const maxDescLength = 14; 
  
  return normalizers
    .reduce((d, {to, from}) => 
      d.replaceAll(new RegExp(from.sort((a, b) => b.length - a.length).join('|'), 'g'), to),
      description
    )
    .split(/[^A-Za-z]/)
    .reduce((msg, token) => 
      ((msg + ' ' + token).length <= maxDescLength ? 
        (msg + ' ' + token) : 
        msg.padEnd(maxDescLength, ' ')).trim()
    )
    .padEnd(maxDescLength, ' '); // Ensure consistent length
} 