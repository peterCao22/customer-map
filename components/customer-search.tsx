"use client"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, X } from "lucide-react"

interface CustomerSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedTags: string[]
  allTags: string[]
  onTagToggle: (tag: string) => void
  showStrategicOnly: boolean
  onStrategicToggle: (checked: boolean) => void
}

export function CustomerSearch({
  searchQuery,
  onSearchChange,
  selectedTags,
  allTags,
  onTagToggle,
  showStrategicOnly,
  onStrategicToggle,
}: CustomerSearchProps) {
  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search company name, email or address..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => onSearchChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* 标签过滤 */}
      <div>
        <div className="text-sm font-medium mb-2">Filter by tags:</div>
        <div className="flex flex-wrap gap-2">
          {allTags
            .filter((tag) => tag !== "STRATEGIC ACCOUNTS") // 隐藏STRATEGIC ACCOUNTS标签
            .map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/10"
              onClick={() => onTagToggle(tag)}
            >
              {tag}
              {selectedTags.includes(tag) && <X className="ml-1 h-3 w-3" />}
            </Badge>
          ))}
        </div>

        {selectedTags.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 text-xs"
            onClick={() => selectedTags.forEach((tag) => onTagToggle(tag))}
          >
            Clear all filters
          </Button>
        )}
      </div>

      {/* 战略客户复选框 */}
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="strategic-accounts"
          checked={showStrategicOnly}
          onCheckedChange={onStrategicToggle}
        />
        <label 
          htmlFor="strategic-accounts" 
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          STRATEGIC ACCOUNTS
        </label>
      </div>
    </div>
  )
}
