import definition from "./definition";
import execute from "./execute";

export * from "./definition";
export * from "./execute";

const getSingleDataTool = {
  name: definition.name,
  definition,
  execute,
};

export default getSingleDataTool;

