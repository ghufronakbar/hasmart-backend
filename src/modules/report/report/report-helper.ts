import path from "path";

export class ReportHelper {
  static getFonts() {
    return {
      Roboto: {
        normal: path.join(
          __dirname,
          "../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf",
        ),
        bold: path.join(
          __dirname,
          "../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf",
        ),
        italics: path.join(
          __dirname,
          "../../../../node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf",
        ),
        bolditalics: path.join(
          __dirname,
          "../../../../node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf",
        ),
      },
    };
  }

  static getStyles() {
    return {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      subHeader: { fontSize: 14, bold: true, color: "#444" },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: "black",
        fillColor: "#eeeeee",
      },
    };
  }

  static formatCurrency(value: number): string {
    return value.toLocaleString("id-ID");
  }

  static formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("id-ID");
  }
}
