"use client"

import type { Customer } from "./customer-map-view"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Mail, Phone, Building } from "lucide-react"
import { cn } from "@/lib/utils"

interface CustomerListProps {
  customers: Customer[]
  selectedCustomer: Customer | null
  onCustomerSelect: (customer: Customer) => void
}

export function CustomerList({ customers, selectedCustomer, onCustomerSelect }: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>没有找到匹配的客户</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-3">
        {customers.map((customer) => (
          <Card
            key={customer.id}
            className={cn(
              "p-4 cursor-pointer transition-all hover:shadow-md",
              selectedCustomer?.id === customer.id && "ring-2 ring-primary bg-primary/5",
            )}
            onClick={() => onCustomerSelect(customer)}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">{customer.companyName}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {customer.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {customer.tags.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{customer.tags.length - 2}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate">{customer.email}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{customer.phone}</span>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{customer.address}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
