import { useState } from "react";
import { useTranslation } from "react-i18next";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { WiringDiagram } from "@/components/WiringDiagram";
import { Battery3DViewer } from "@/components/Battery3DViewer";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, CircuitBoard, DollarSign, Download, ExternalLink, FileSpreadsheet, FileText, Lock, Zap, Box } from "lucide-react";
import type { Configuration } from "./types";
import { formatUnit } from "./utils";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

interface SolutionDetailModalProps {
  solution: Configuration;
  isOpen: boolean;
  onClose: () => void;
  showComponents: boolean;
  dataSource: "default" | "custom";
}

export const SolutionDetailModal = ({ solution, isOpen, onClose, showComponents, dataSource }: SolutionDetailModalProps) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [showDiagram, setShowDiagram] = useState(false);
  const [show3D, setShow3D] = useState(false);

  const [laborCost, setLaborCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [margin, setMargin] = useState(20);
  const [includeCostsInBom, setIncludeCostsInBom] = useState(true);

  if (!solution) return null;

  const basePrice = solution.total_price;
  const costPrice = basePrice + laborCost + shippingCost;
  const finalPrice = costPrice * (1 + margin / 100);

  const AffiliateLink = ({ link }: { link?: string }) => {
    if (!link) return null;
    return (
      <a href={link} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1 mt-1">
        {t('solutionModal.buyFromAffiliate')} <ExternalLink className="inline w-3 h-3" />
      </a>
    );
  };

  const downloadDatasheet_word = async () => {
    const watermark = new Paragraph({
      children: [
        new TextRun({
          text: "WATT BUILDER",
          color: "D9D9D9",
          size: 120,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 3000 },
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            watermark,
            new Paragraph({ text: "" }),
            new Paragraph({
              text: t('solutionModal.docs.title'),
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: t('solutionModal.docs.generatedBy'),
                  italics: true,
                  color: "666666",
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: `${t('solutionModal.docs.config')} `, bold: true }),
                new TextRun(`${solution.series_cells}S ${solution.parallel_cells}P`),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `${t('solutionModal.docs.cellModel')} `, bold: true }),
                new TextRun(`${solution.cell.Brand} ${solution.cell.CellModelNo}`),
              ],
            }),

            new Paragraph({
              text: t('solutionModal.docs.electricalSpecs'),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400 },
            }),
            new Paragraph(`${t('solutionModal.docs.nominalVoltage')} ${solution.battery_voltage.toFixed(1)} V`),
            new Paragraph(`${t('solutionModal.docs.capacity')} ${solution.battery_capacity.toFixed(1)} Ah`),
            new Paragraph(`${t('solutionModal.docs.totalEnergy')} ${formatUnit(solution.battery_energy, "Wh")}`),
            new Paragraph(`${t('solutionModal.docs.contPower')} ${formatUnit(solution.continuous_power, "W")}`),
            new Paragraph(`${t('solutionModal.docs.peakPower')} ${formatUnit(solution.peak_power, "W")}`),

            new Paragraph({
              text: t('solutionModal.docs.mechanicalSpecs'),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400 },
            }),
            new Paragraph(`${t('solutionModal.docs.cellWeight')} ${solution.battery_weight.toFixed(2)} kg`),
            new Paragraph(
              `${t('solutionModal.docs.cellDimensions')} ${solution.cell.Cell_Width} × ${solution.cell.Cell_Height} mm`
            ),

            new Paragraph({
              text: t('solutionModal.docs.safetyAssessment'),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400 },
            }),
            new Paragraph(`${t('solutionModal.docs.safetyScore')} ${solution.safety.safety_score}/100`),
            new Paragraph(
              `${t('solutionModal.docs.status')} ${solution.safety.is_safe ? t('solutionModal.docs.pass') : t('solutionModal.docs.warning')}`
            ),
            new Paragraph(
              `${t('solutionModal.docs.warnings')} ${solution.safety.warnings.length
                ? solution.safety.warnings.join("; ")
                : t('solutionModal.docs.none')
              }`
            ),

            new Paragraph({
              spacing: { before: 600 },
              children: [
                new TextRun({
                  text: t('solutionModal.docs.disclaimer'),
                  italics: true,
                  color: "666666",
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Datasheet_${solution.series_cells}S${solution.parallel_cells}P.docx`);
  };

  const requireAuthForDownload = (action: () => void) => {
    if (!isAuthenticated) {
      toast({
        title: t('solutionModal.toasts.loginRequired'),
        description: t('solutionModal.toasts.loginToDownload'),
        variant: "destructive",
      });
      return;
    }
    action();
  };

  const downloadBOM = () => {
    const rows = [[
      t('solutionModal.bom.component'),
      t('solutionModal.bom.model'),
      t('solutionModal.bom.quantity'),
      t('solutionModal.bom.details')
    ]];

    if (includeCostsInBom) {
      rows[0].push(t('solutionModal.bom.unitPrice'), t('solutionModal.bom.totalPrice'));
    }

    const addRow = (name: string, model: string, qty: number, details: string, unitPrice: number) => {
      const row = [name, model, qty.toString(), details];
      if (includeCostsInBom) {
        row.push(unitPrice.toFixed(2), (unitPrice * qty).toFixed(2));
      }
      rows.push(row);
    };

    const totalCells = solution.series_cells * solution.parallel_cells;
    addRow(
      t('solutionModal.bom.batteryCells'),
      solution.cell.CellModelNo,
      totalCells,
      `${solution.cell.NominalVoltage}V ${solution.cell.Capacity}mAh`,
      solution.cell.Price
    );

    if (solution.bms) addRow("BMS", solution.bms.model, 1, `Max ${solution.bms.a_max}A`, solution.bms.master_price || solution.bms.price);
    if (solution.fuse) addRow("Fuse", solution.fuse.model, 1, `${solution.fuse.a_max}A`, solution.fuse.price);
    if (solution.relay) addRow("Relay", solution.relay.model, 1, `${solution.relay.a_max}A`, solution.relay.price);
    if (solution.shunt) addRow("Shunt", solution.shunt.model, 1, `${solution.shunt.a_max}A`, solution.shunt.price);
    if (solution.cable) addRow(t('solutionModal.bom.cable'), solution.cable.model, 1, `${solution.cable.section}mm²`, solution.cable.price);

    if (includeCostsInBom && laborCost > 0) rows.push([t('solutionModal.bom.labor'), "-", "1", "-", laborCost.toFixed(2), laborCost.toFixed(2)]);
    if (includeCostsInBom && shippingCost > 0) rows.push([t('solutionModal.bom.shipping'), "-", "1", "-", shippingCost.toFixed(2), shippingCost.toFixed(2)]);

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BOM_${solution.series_cells}S${solution.parallel_cells}P_${solution.cell.CellModelNo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadDatasheet_pdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 30;

    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(80);
    doc.setTextColor(150, 150, 150);
    const centerX = pageWidth / 2 + 30;
    const centerY = pageHeight / 2 + 30;
    doc.text("Watt Builder", centerX, centerY, { align: "center", angle: 45 });
    doc.restoreGraphicsState();

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(20);
    doc.text(t('solutionModal.docs.title'), margin, 20);

    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`${t('solutionModal.docs.generatedBy')} • ${new Date().toLocaleDateString()}`, margin, 26);

    const section = (title: string) => {
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(249, 115, 22);
      doc.text(title.toUpperCase(), margin, y);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    };

    const row = (label: string, value: string) => {
      doc.text(label, margin, y);
      doc.text(value, margin + 70, y);
      y += 6;
    };

    section(t('solutionModal.docs.projectOverview'));
    row(t('solutionModal.docs.config'), `${solution.series_cells}S ${solution.parallel_cells}P`);
    row(t('solutionModal.docs.cellModel'), `${solution.cell.Brand} ${solution.cell.CellModelNo}`);
    row(t('solutionModal.docs.totalCells'), `${solution.series_cells * solution.parallel_cells}`);

    section(t('solutionModal.docs.electricalSpecs'));
    row(t('solutionModal.docs.nominalVoltage'), `${solution.battery_voltage.toFixed(1)} V`);
    row(t('solutionModal.docs.capacity'), `${solution.battery_capacity.toFixed(1)} Ah`);
    row(t('solutionModal.docs.totalEnergy'), formatUnit(solution.battery_energy, "Wh"));
    row(t('solutionModal.docs.contPower'), formatUnit(solution.continuous_power, "W"));
    row(t('solutionModal.docs.peakPower'), formatUnit(solution.peak_power, "W"));

    section(t('solutionModal.docs.mechanicalSpecs'));
    row(t('solutionModal.docs.cellWeight'), `${solution.battery_weight.toFixed(2)} kg`);
    row(t('solutionModal.docs.cellDimensions'), `${solution.cell.Cell_Width} × ${solution.cell.Cell_Height} mm`);

    section(t('solutionModal.docs.safetyAssessment'));
    doc.setFont("helvetica", "bold");
    doc.text(`${t('solutionModal.docs.safetyScore')} ${solution.safety.safety_score}/100`, margin, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    if (solution.safety.warnings.length) {
      solution.safety.warnings.forEach((w) => {
        const tObj = doc.splitTextToSize(`• ${w}`, pageWidth - margin * 2);
        doc.text(tObj, margin, y);
        y += tObj.length * 5;
      });
    } else {
      doc.text(t('solutionModal.docs.noCriticalWarnings'), margin, y);
    }

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(t('solutionModal.docs.disclaimer'), margin, pageHeight - 15);

    doc.save(`Datasheet_${solution.series_cells}S${solution.parallel_cells}P_${solution.cell.CellModelNo}.pdf`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            {t('solutionModal.modal.configTitle', { model: solution.cell.CellModelNo, series: solution.series_cells, parallel: solution.parallel_cells })}
            <Badge className={solution.safety.is_safe ? "bg-emerald-600" : "bg-red-600"}>
              {t('solutionModal.modal.safetyScore', { score: solution.safety.safety_score })}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 my-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <InfoTooltip content="Important Disclaimer" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-orange-700 font-medium">
                <strong>{t('solutionModal.modal.disclaimerTitle')}</strong>
              </p>
              <p className="text-sm text-orange-700 mt-1">
                {t('solutionModal.modal.disclaimerText1')}
                <strong> {t('solutionModal.modal.disclaimerText2')}</strong>
              </p>
            </div>
          </div>
        </div>

        {dataSource === "default" && solution.safety.warnings.length > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-4">
            <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5" /> {t('solutionModal.modal.safetyAdvisories')}
            </h4>
            <ul className="list-disc pl-5 text-sm text-amber-900 space-y-1">
              {solution.safety.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            {solution.safety.recommendations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <span className="text-xs font-bold uppercase text-amber-700">{t('solutionModal.modal.recommendations')}</span>
                <ul className="list-disc pl-5 text-sm text-amber-800 mt-1">
                  {solution.safety.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('solutionModal.modal.specsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>{t('solutionModal.modal.specsConfig')}</strong> {solution.series_cells}S {solution.parallel_cells}P</p>
                <p><strong>{t('solutionModal.modal.specsNominalVolt')}</strong> {solution.battery_voltage.toFixed(1)} V</p>
                <p><strong>{t('solutionModal.modal.specsCapacity')}</strong> {solution.battery_capacity.toFixed(1)} Ah</p>
                <p><strong>{t('solutionModal.modal.specsEnergy')}</strong> {formatUnit(solution.battery_energy, "Wh")}</p>
                <p><strong>{t('solutionModal.modal.specsContPower')}</strong> {formatUnit(solution.continuous_power, "W")}</p>
                <p><strong>{t('solutionModal.modal.specsPeakPower')}</strong> {formatUnit(solution.peak_power, "W")}</p>
                <p><strong>{t('solutionModal.modal.specsCellWeight')}</strong> {solution.battery_weight.toFixed(2)} kg</p>
                <p className="font-bold mt-2 border-t pt-1">{t('solutionModal.modal.specsCompPrice')} ${solution.total_price.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('solutionModal.modal.cellDataTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p><strong>{t('solutionModal.modal.cellBrand')}</strong> {solution.cell.Brand}</p>
                <p><strong>{t('solutionModal.modal.cellModel')}</strong> {solution.cell.CellModelNo}</p>
                <p><strong>{t('solutionModal.modal.cellNominalVolt')}</strong> {solution.cell.NominalVoltage}</p>
                <p><strong>{t('solutionModal.modal.cellContDischarge')}</strong> {solution.cell.MaxContinuousDischargeRate}C</p>
                <p><strong>{t('solutionModal.modal.cellCapacity')}</strong> {solution.cell.Capacity / 1000} Ah</p>
                <p><strong>{t('solutionModal.modal.cellPrice')}</strong> ${solution.cell.Price.toFixed(2)}</p>
                <AffiliateLink link={solution.cell.Connection} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" /> {t('solutionModal.modal.toolsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{t('solutionModal.modal.laborCost')}</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={laborCost}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val < 0) {
                          toast({
                            title: 'Valor Inválido',
                            description: 'O valor não pode ser negativo.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setLaborCost(val);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('solutionModal.modal.shippingCost')}</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={shippingCost}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val < 0) {
                          toast({
                            title: 'Valor Inválido',
                            description: 'O valor não pode ser negativo.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setShippingCost(val);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t('solutionModal.modal.profitMargin')}</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={margin}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val < 0) {
                        toast({
                          title: 'Valor Inválido',
                          description: 'O valor não pode ser negativo.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      setMargin(val);
                    }}
                  />
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-slate-600">{t('solutionModal.modal.baseCost')}</span>
                    <span className="text-sm">${costPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-green-700">{t('solutionModal.modal.finalPrice')}</span>
                    <span className="text-lg font-bold text-green-700">${finalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="w-4 h-4" /> {t('solutionModal.modal.downloadsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2 pb-2">
                  <Checkbox
                    id="bomCosts"
                    checked={includeCostsInBom}
                    onCheckedChange={(c) => setIncludeCostsInBom(c as boolean)}
                  />
                  <Label htmlFor="bomCosts" className="text-xs cursor-pointer">{t('solutionModal.modal.includeCostsBom')}</Label>
                </div>
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => requireAuthForDownload(downloadBOM)}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                  {t('solutionModal.modal.downloadBom')}
                  {!isAuthenticated && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                </Button>
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => requireAuthForDownload(downloadDatasheet_word)}>
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  {t('solutionModal.modal.downloadWord')}
                  {!isAuthenticated && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                </Button>
                <Button variant="outline" className="w-full justify-start h-9" onClick={() => requireAuthForDownload(downloadDatasheet_pdf)}>
                  <FileText className="w-4 h-4 mr-2 text-red-600" />
                  {t('solutionModal.modal.downloadPdf')}
                  {!isAuthenticated && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                </Button>
              </CardContent>
            </Card>
          </div>

          {showComponents && (
            <div className="space-y-4">
              {solution.bms && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> BMS</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>{t('solutionModal.modal.bmsBrand')}</strong> {solution.bms.brand}</p>
                    <p><strong>{t('solutionModal.modal.bmsModel')}</strong> {solution.bms.model}</p>
                    <p><strong>{t('solutionModal.modal.bmsSpec')}</strong> {solution.bms.a_max}A / {solution.bms.max_cells} {t('solutionModal.modal.cells')}</p>
                    <p><strong>{t('solutionModal.modal.bmsPrice')}</strong> ${solution.bms.master_price?.toFixed(2) || solution.bms.price.toFixed(2)}</p>
                    <AffiliateLink link={solution.bms.link} />
                  </CardContent>
                </Card>
              )}
              {solution.fuse && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Fuse</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>{t('solutionModal.modal.fuseModel')}</strong> {solution.fuse.brand} {solution.fuse.model}</p>
                    <p><strong>{t('solutionModal.modal.fuseRating')}</strong> {solution.fuse.a_max}A / {solution.fuse.vdc_max}V</p>
                    <p><strong>{t('solutionModal.modal.bmsPrice')}</strong> ${solution.fuse.price.toFixed(2)}</p>
                    <AffiliateLink link={solution.fuse.link} />
                  </CardContent>
                </Card>
              )}
              {solution.relay && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Relay</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>{t('solutionModal.modal.fuseModel')}</strong> {solution.relay.brand} {solution.relay.model}</p>
                    <p><strong>{t('solutionModal.modal.fuseRating')}</strong> {solution.relay.a_max}A / {solution.relay.vdc_max}V</p>
                    <p><strong>{t('solutionModal.modal.bmsPrice')}</strong> ${solution.relay.price.toFixed(2)}</p>
                    <AffiliateLink link={solution.relay.link} />
                  </CardContent>
                </Card>
              )}
              {solution.cable && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cabling</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>{t('solutionModal.modal.fuseModel')}</strong> {solution.cable.brand} {solution.cable.model}</p>
                    <p><strong>{t('solutionModal.modal.cableCross')}</strong> {solution.cable.section} mm²</p>
                    <p><strong>{t('solutionModal.modal.fuseRating')}</strong> {solution.cable.a_max} A / {solution.cable.vdc_max} V</p>
                    <AffiliateLink link={solution.cable.link} />
                  </CardContent>
                </Card>
              )}
              {solution.shunt && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Shunt</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p><strong>{t('solutionModal.modal.fuseModel')}</strong> {solution.shunt.brand} {solution.shunt.model}</p>
                    <p><strong>{t('solutionModal.modal.fuseRating')}</strong> {solution.shunt.a_max} A / {solution.shunt.vdc_max} V</p>
                    <AffiliateLink link={solution.shunt.link} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {showComponents && (
          <div className="flex flex-col gap-6 mt-6">
            <div>
              <Button
                variant="outline"
                className={`w-full flex items-center justify-between border-slate-300 text-slate-700 hover:bg-slate-50 ${show3D ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                onClick={() => setShow3D(!show3D)}
              >
                <span className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-blue-600" />
                  {show3D ? t('solutionModal.modal.hide3d') : t('solutionModal.modal.show3d')}
                </span>
                {show3D ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </Button>

              {show3D && (
                <div className="mt-4 animate-in fade-in zoom-in-95 duration-300">
                  <Battery3DViewer config={solution} />
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    {t('solutionModal.modal.interactive3d')}
                    <br />{t('solutionModal.modal.interactive3dHelp')}
                  </p>
                </div>
              )}
            </div>

            <div>
              <Button
                variant="outline"
                className={`w-full flex items-center justify-between border-slate-300 text-slate-700 hover:bg-slate-50 ${showDiagram ? 'bg-amber-50 border-amber-300 text-amber-700' : ''}`}
                onClick={() => setShowDiagram(!showDiagram)}
              >
                <span className="flex items-center gap-2">
                  <CircuitBoard className="w-4 h-4 text-amber-600" />
                  {showDiagram ? t('solutionModal.modal.hideDiagram') : t('solutionModal.modal.showDiagram')}
                </span>
                {showDiagram ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </Button>

              {showDiagram && (
                <div className="mt-4 animate-in fade-in zoom-in-95 duration-300">
                  <WiringDiagram config={solution} />
                </div>
              )}
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};