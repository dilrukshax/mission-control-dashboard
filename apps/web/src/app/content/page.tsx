import { QuickContentDropForm } from "../components/QuickCreateForms";
import { fetchContentDrops } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, ExternalLink } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export default async function ContentPage() {
  const items = await fetchContentDrops();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight">Content</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Content drops and artifacts from agents</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Content Drops ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-30" />
                  <p className="mt-3 text-sm">No content yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                                            <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[100px] text-right">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.title}</div>
                          {item.content_preview && (
                            <div className="line-clamp-1 text-xs text-muted-foreground mt-0.5">
                              {item.content_preview}
                            </div>
                          )}
                          {item.link && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs text-blue-500 hover:underline">
                              <ExternalLink className="h-3 w-3" />
                              Link
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{item.content_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === "published" ? "success" : "secondary"} className="text-xs">
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {timeAgo(item.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <QuickContentDropForm />
      </div>
    </div>
  );
}
