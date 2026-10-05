import { SentenceCue } from "./types";

export const SAMPLE_STORY_TITLE = "Star Light, Star Bright (Sample Story)";

// Public HTML5 Big Buck Bunny or synthetic open video clip for immediate testing
export const SAMPLE_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

export const SAMPLE_CUES: SentenceCue[] = [
  {
    id: 1,
    startTime: 0.5,
    endTime: 3.2,
    text: "Rain was pouring down from the cloudy sky.",
  },
  {
    id: 2,
    startTime: 3.5,
    endTime: 6.8,
    text: "The little puppy was looking for a dry place to rest.",
  },
  {
    id: 3,
    startTime: 7.0,
    endTime: 9.8,
    text: "Suddenly, he saw a bright warm light ahead.",
  },
  {
    id: 4,
    startTime: 10.0,
    endTime: 12.5,
    text: "It was a cozy wooden barn near the green hill.",
  },
  {
    id: 5,
    startTime: 12.8,
    endTime: 15.0,
    text: "He ran quickly inside and wagged his tail happily.",
  },
];
