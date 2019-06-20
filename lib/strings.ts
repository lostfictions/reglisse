export default function createStringStore() {
  const stringIds: { [str: string]: number } = { "": 0 };
  const stringValues = [""];
  return {
    id(str: string): number {
      let result = stringIds[str];
      if (result) {
        return result;
      }
      result = stringIds[str] = stringValues.length;
      stringValues.push(str);
      return result;
    },

    str(id: number): string {
      return stringValues[id];
    }
  };
}
