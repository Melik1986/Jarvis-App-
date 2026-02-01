// Mock AsyncStorage for Node (no window). Zustand persist uses getItem/setItem/removeItem.
/* global jest */
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    clear: async () => {},
  },
}));
