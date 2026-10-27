// Vector icons load font assets through expo-font, which is not available in
// the Jest environment. Render a lightweight text stand-in instead.
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const MockIcon = ({ name, testID }: { name?: string; testID?: string }) =>
    React.createElement(Text, { testID }, name ?? "icon");

  return { Ionicons: MockIcon };
});
