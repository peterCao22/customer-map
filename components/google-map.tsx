"use client"

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react"
import type { Customer } from "./customer-map-view"

interface GoogleMapProps {
  customers: Customer[]
  selectedCustomer: Customer | null
  onCustomerSelect: (customer: Customer) => void
  showSalesRange?: boolean // 添加显示销售范围的prop
}

export interface GoogleMapRef {
  resetView: () => void
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export const GoogleMap = forwardRef<GoogleMapRef, GoogleMapProps>(
  ({ customers, selectedCustomer, onCustomerSelect, showSalesRange = false }, ref) => {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markersRef = useRef<any[]>([])
    const circlesRef = useRef<any[]>([]) // 添加圆形覆盖层引用
    const infoWindowRef = useRef<any>(null)
    const statePolygonsRef = useRef<any[]>([]) // 添加州级多边形覆盖层引用
    const overlayTimersRef = useRef<number[]>([]) // 管理州覆盖层相关的延迟回调
    const overlaysActiveRef = useRef<boolean>(false) // 当前是否处于州覆盖层显示状态
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [currentZoom, setCurrentZoom] = useState(5) // 当前缩放级别
    const currentZoomRef = useRef<number>(5)

    useEffect(() => {
      currentZoomRef.current = currentZoom
    }, [currentZoom])


    // 根据销售量获取标记颜色
    const getColorByAmount = (totalAmount: number | null) => {
      if (!totalAmount || totalAmount <= 0) return "#6b7280" // 灰色（无销售数据/销售量为0）
      return "#3b82f6" // 蓝色（有销售数据）
    }

    // 根据客户销售量计算标记圆圈大小（固定分级）
    const getMarkerSizeByAmount = (totalAmount: number | null) => {
      if (!totalAmount || totalAmount <= 0) return 10 // 特例：无销售或<=0
      if (totalAmount >= 500000) return 35 // 分级1
      if (totalAmount >= 200000) return 30 // 分级2
      if (totalAmount >= 120000) return 26 // 分级3
      if (totalAmount >= 80000) return 24  // 分级4
      if (totalAmount >= 40000) return 20  // 分级5
      if (totalAmount >= 12000) return 15  // 分级6
      return 12                              // 分级7
    }

    // 创建可变大小的销售标记SVG
    const createSalesBasedMarker = (color: string, radius: number, isSelected: boolean = false) => {
      const size = radius * 2 + 10 // SVG总大小（留足边距）
      const strokeColor = isSelected ? "#ef4444" : "white"
      const strokeWidth = isSelected ? 4 : 2
      const centerDotSize = Math.max(2, Math.min(6, radius / 4)) // 中心点大小随圆圈调整
      
      const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/><circle cx="${size/2}" cy="${size/2}" r="${centerDotSize}" fill="white"/></svg>`
      
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgContent)}`
    }

    // 美国各州人口数据（2020年人口普查）
    const STATE_POPULATION_DATA: { [stateAbbr: string]: number } = {
      "CA": 39538223, // 加利福尼亚州
      "TX": 29145505, // 德克萨斯州
      "FL": 21538187, // 佛罗里达州
      "NY": 20201249, // 纽约州
      "PA": 13002700, // 宾夕法尼亚州
      "IL": 12812508, // 伊利诺伊州
      "OH": 11799448, // 俄亥俄州
      "GA": 10711908, // 乔治亚州
      "NC": 10439388, // 北卡罗来纳州
      "MI": 10037261, // 密歇根州
      "NJ": 9288994,  // 新泽西州
      "VA": 8631393,  // 弗吉尼亚州
      "WA": 7705281,  // 华盛顿州
      "AZ": 7151502,  // 亚利桑那州
      "MA": 7001399,  // 马萨诸塞州
      "TN": 6910840,  // 田纳西州
      "IN": 6785528,  // 印第安纳州
      "MO": 6196515,  // 密苏里州
      "MD": 6177224,  // 马里兰州
      "WI": 5893718,  // 威斯康星州
      "CO": 5773714,  // 科罗拉多州
      "MN": 5737915,  // 明尼苏达州
      "SC": 5118425,  // 南卡罗来纳州
      "AL": 5024279,  // 阿拉巴马州
      "LA": 4657757,  // 路易斯安那州
      "KY": 4505836,  // 肯塔基州
      "OR": 4237256,  // 俄勒冈州
      "OK": 3959353,  // 俄克拉荷马州
      "CT": 3605944,  // 康涅狄格州
      "UT": 3271616,  // 犹他州
      "IA": 3190369,  // 爱荷华州
      "NV": 3104614,  // 内华达州
      "AR": 3011524,  // 阿肯色州
      "MS": 2961279,  // 密西西比州
      "KS": 2937880,  // 堪萨斯州
      "NM": 2117522,  // 新墨西哥州
      "NE": 1961504,  // 内布拉斯加州
      "ID": 1839106,  // 爱达荷州
      "WV": 1793716,  // 西弗吉尼亚州
      "HI": 1455271,  // 夏威夷州
      "NH": 1377529,  // 新罕布什尔州
      "ME": 1362359,  // 缅因州
      "RI": 1097379,  // 罗德岛州
      "MT": 1084225,  // 蒙大拿州
      "DE": 989948,   // 特拉华州
      "SD": 886667,   // 南达科他州
      "ND": 779094,   // 北达科他州
      "AK": 733391,   // 阿拉斯加州
      "VT": 643077,   // 佛蒙特州
      "WY": 576851,   // 怀俄明州
      "DC": 689545,   // 华盛顿特区
    }

    // 验证数据对象完整性
    const validateStateData = () => {
      try {
        if (!STATE_POPULATION_DATA || typeof STATE_POPULATION_DATA !== 'object') {
          return false
        }
        
        if (!STATE_CENTER_COORDS || typeof STATE_CENTER_COORDS !== 'object') {
          return false
        }
        
        // 验证关键州是否存在
        const criticalStates = ['CA', 'TX', 'FL', 'NY', 'HI']
        for (const state of criticalStates) {
          if (!(state in STATE_POPULATION_DATA)) {
            return false
          }
          if (!(state in STATE_CENTER_COORDS)) {
            return false
          }
        }
        
        return true
      } catch (error) {
        return false
      }
    }

    // 根据人口数量获取州级黄色系颜色（增强对比度）
    const getStatePopulationColor = (stateAbbr: string) => {
      try {
        // 安全检查输入和数据对象
        if (!stateAbbr || typeof stateAbbr !== 'string' || !STATE_POPULATION_DATA) {
          return '#f8f9fa' // 返回默认浅灰色
        }

      const population = STATE_POPULATION_DATA[stateAbbr] || 0
      if (population === 0) return '#f8f9fa' // 无数据时为浅灰色
      
        // 安全地获取最大人口数值
        let maxPopulation = 39538223 // 默认使用加州人口作为最大值
        try {
          if (STATE_POPULATION_DATA && typeof STATE_POPULATION_DATA === 'object') {
            const populationValues = Object.values(STATE_POPULATION_DATA)
            if (populationValues.length > 0) {
              maxPopulation = Math.max(...populationValues)
            }
          }
        } catch (valuesError) {
          // 使用默认值
        }
        
      const intensity = population / maxPopulation
      
      // 增强的黄橙色系渐变：从象牙白到深橙色，对比更明显
      if (intensity >= 0.8) return '#CC6600' // 深橙色（人口最多：CA, TX, FL, NY）
      if (intensity >= 0.6) return '#FF7F00' // 橙色（人口较多：PA, IL, OH, GA）
      if (intensity >= 0.4) return '#FFA500' // 亮橙色（人口中等：NC, MI, NJ, VA）
      if (intensity >= 0.2) return '#FFD700' // 金色（人口较少：WA, AZ, MA等）
      if (intensity >= 0.1) return '#FFFF99' // 浅黄色（人口更少）
      return '#FFFACD'                       // 柠檬绸（人口最少：WY, VT, AK等）
      } catch (error) {
        return '#f8f9fa' // 返回默认浅灰色
      }
    }

    // 根据客户数量获取州级热力图颜色（保留用于圆形覆盖层降级方案）
    const getStateHeatColor = (customerCount: number, maxCount: number) => {
      if (customerCount === 0) return '#ffffff' // 白色（不显示）
      const intensity = customerCount / maxCount
      if (intensity >= 0.8) return '#8B0000' // 深红色 - 客户最多
      if (intensity >= 0.6) return '#DC143C' // 红色
      if (intensity >= 0.4) return '#FF6347' // 橙红色  
      if (intensity >= 0.2) return '#FFA500' // 橙色
      return '#FFD700' // 金色 - 客户最少
    }


    // 检查环境变量配置
    const checkEnvironmentConfig = () => {
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      
    }

    // 根据客户州分组统计
    const getCustomersByState = () => {
      try {
      const stateStats = new Map<string, number>()
        
        if (!customers || !Array.isArray(customers)) {
          return stateStats
        }

      customers.forEach(customer => {
          try {
            const state = customer?.state?.trim()
            if (state && state.length === 2 && typeof state === 'string') { // 美国州缩写都是2个字母
              // 只统计美国州，过滤掉加拿大省份等
              if (STATE_POPULATION_DATA && STATE_POPULATION_DATA[state]) {
                stateStats.set(state, (stateStats.get(state) || 0) + 1)
              }
            }
          } catch (customerError) {
            // 跳过有问题的客户数据
          }
      })
      return stateStats
      } catch (error) {
        return new Map<string, number>()
      }
    }





    // 创建州级Choropleth Map（按照官方文档实现）
    const createStateOverlays = async () => {
      if (!mapInstanceRef.current || !window.google) return
      
      try {
        // 清除现有的州级覆盖
      clearStateOverlays()
      overlaysActiveRef.current = true
      // 清理遗留定时器
      overlayTimersRef.current.forEach(id => clearTimeout(id))
      overlayTimersRef.current = []
      
        const stateStats = getCustomersByState()
        if (!stateStats) {
          return
        }
        
        const stateValues = Array.from(stateStats.values())
        const maxCount = stateValues.length > 0 ? Math.max(...stateValues) : 1
        

        // 临时测试：强制使用降级方案来验证它是否工作
        // 可以在控制台查看是否有圆圈标记
        if (window.location.search.includes('force-fallback')) {
          createEnhancedFallbackOverlay()
          return
        }

        // 检查FeatureLayer是否可用
        let featureLayer = null
        try {
          featureLayer = mapInstanceRef.current.getFeatureLayer("ADMINISTRATIVE_AREA_LEVEL_1")
        } catch (err: any) {
          throw new Error('FeatureLayer not configured in Map Style')
        }
        
        // 创建客户数据映射（用于样式设置）
        const stateCustomerData: { [stateAbbr: string]: number } = {}
        stateStats.forEach((count, stateAbbr) => {
          stateCustomerData[stateAbbr] = count
        })

        // 设置州边界样式（按照官方文档的模式）
                  featureLayer.style = (options: any) => {
            const feature = options.feature
            
            // 使用 Place ID 匹配客户数据（官方推荐方法）
            const placeId = feature.placeId
            

            
            // 美国各州的 Place ID 到缩写映射（使用官方示例的精确 Place ID）
            const placeIdToStateMap: { [placeId: string]: string } = {
              "ChIJdf5LHzR_hogR6czIUzU0VV4": "AL", // Alabama
              "ChIJG8CuwJzfAFQRNduKqSde27w": "AK", // Alaska
              "ChIJaxhMy-sIK4cRcc3Bf7EnOUI": "AZ", // Arizona
              "ChIJYSc_dD-e0ocR0NLf_z5pBaQ": "AR", // Arkansas
              "ChIJPV4oX_65j4ARVW8IJ6IJUYs": "CA", // California
              "ChIJt1YYm3QUQIcR_6eQSTGDVMc": "CO", // Colorado
              "ChIJpVER8hFT5okR5XBhBVttmq4": "CT", // Connecticut
              "ChIJO9YMTXYFx4kReOgEjBItHZQ": "DE", // Delaware
              "ChIJvypWkWV2wYgR0E7HW9MTLvc": "FL", // Florida
              "ChIJV4FfHcU28YgR5xBP7BC8hGY": "GA", // Georgia
              "ChIJBeB5Twbb_3sRKIbMdNKCd0s": "HI", // Hawaii
              "ChIJ6Znkhaj_WFMRWIf3FQUwa9A": "ID", // Idaho
              "ChIJGSZubzgtC4gRVlkRZFCCFX8": "IL", // Illinois
              "ChIJHRv42bxQa4gRcuwyy84vEH4": "IN", // Indiana
              "ChIJGWD48W9e7ocR2VnHV0pj78Y": "IA", // Iowa
              "ChIJawF8cXEXo4cRXwk-S6m0wmg": "KS", // Kansas
              "ChIJyVMZi0xzQogR_N_MxU5vH3c": "KY", // Kentucky
              "ChIJZYIRslSkIIYRA0flgTL3Vck": "LA", // Louisiana
              "ChIJ1YpTHd4dsEwR0KggZ2_MedY": "ME", // Maine
              "ChIJ35Dx6etNtokRsfZVdmU3r_I": "MD", // Maryland
              "ChIJ_b9z6W1l44kRHA2DVTbQxkU": "MA", // Massachusetts
              "ChIJEQTKxz2qTE0Rs8liellI3Zc": "MI", // Michigan
              "ChIJmwt4YJpbWE0RD6L-EJvJogI": "MN", // Minnesota
              "ChIJGdRK5OQyKIYR2qbc6X8XDWI": "MS", // Mississippi
              "ChIJfeMiSNXmwIcRcr1mBFnEW7U": "MO", // Missouri
              "ChIJ04p7LZwrQVMRGGwqz1jWcfU": "MT", // Montana
              "ChIJ7fwMtciNk4cRxArzDwyQJ6E": "NE", // Nebraska
              "ChIJcbTe-KEKmYARs5X8qooDR88": "NV", // Nevada
              "ChIJ66bAnUtEs0wR64CmJa8CyNc": "NH", // New Hampshire
              "ChIJn0AAnpX7wIkRjW0_-Ad70iw": "NJ", // New Jersey
              "ChIJqVKY50NQGIcRup41Yxpuv0Y": "NM", // New Mexico
              "ChIJqaUj8fBLzEwRZ5UY3sHGz90": "NY", // New York
              "ChIJgRo4_MQfVIgRGa4i6fUwP60": "NC", // North Carolina
              "ChIJY-nYVxKD11IRyc9egzmahA0": "ND", // North Dakota
              "ChIJwY5NtXrpNogRFtmfnDlkzeU": "OH", // Ohio
              "ChIJnU-ssRE5rIcRSOoKQDPPHF0": "OK", // Oklahoma
              "ChIJVWqfm3xuk1QRdrgLettlTH0": "OR", // Oregon
              "ChIJieUyHiaALYgRPbQiUEchRsI": "PA", // Pennsylvania
              "ChIJD9cOYhQ15IkR5wbB57wYTh4": "RI", // Rhode Island
              "ChIJ49ExeWml-IgRnhcF9TKh_7k": "SC", // South Carolina
              "ChIJpTjphS1DfYcRt6SGMSnW8Ac": "SD", // South Dakota
              "ChIJA8-XniNLYYgRVpGBpcEgPgM": "TN", // Tennessee
              "ChIJSTKCCzZwQIYRPN4IGI8c6xY": "TX", // Texas
              "ChIJzfkTj8drTIcRP0bXbKVK370": "UT", // Utah
              "ChIJ_87aSGzctEwRtGtUNnSJTSY": "VT", // Vermont
              "ChIJzbK8vXDWTIgRlaZGt0lBTsA": "VA", // Virginia
              "ChIJ-bDD5__lhVQRuvNfbGh4QpQ": "WA", // Washington
              "ChIJRQnL1KVUSogRQzrN3mjHALs": "WV", // West Virginia
              "ChIJr-OEkw_0qFIR1kmG-LjV1fI": "WI", // Wisconsin
              "ChIJaS7hSDTiXocRLzh90nkisCY": "WY"  // Wyoming
            }
            
            const stateAbbr = placeIdToStateMap[placeId] || ''
          
          // 只对美国州进行样式设置，非美国地区保持默认样式
          if (!stateAbbr || !STATE_POPULATION_DATA || !STATE_POPULATION_DATA[stateAbbr]) {
            // 非美国地区（如加拿大、墨西哥等）返回null，保持地图默认样式
            return null
          }
          
          // 根据州人口数量计算颜色（黄色系渐变）
          const fillColor = getStatePopulationColor(stateAbbr)
          
          return {
            fillColor: fillColor,
            fillOpacity: 0.8, // 保持不透明度
            strokeColor: '#000000', // 黑色边框
            strokeWeight: 1, // 边框粗细
            strokeOpacity: 0.8 // 稍微透明的边框
          }
        }

        // 强制刷新样式以确保应用
        {
          const t1 = window.setTimeout(() => {
            if (!overlaysActiveRef.current || currentZoomRef.current >= 6) return
            if (featureLayer && featureLayer.style) {
              const originalStyle = featureLayer.style
              featureLayer.style = null
              const t1b = window.setTimeout(() => {
                if (!overlaysActiveRef.current || currentZoomRef.current >= 6) return
                featureLayer.style = originalStyle
              }, 100)
              overlayTimersRef.current.push(t1b as unknown as number)
            }
          }, 500)
          overlayTimersRef.current.push(t1 as unknown as number)
        }

        // 添加客户数量标签
        await addStateLabels(stateStats)
        
        // 保存 featureLayer 引用
        statePolygonsRef.current.push(featureLayer)
        
        // 添加备用检查：如果 FeatureLayer 在兼容模式下不显示，使用降级方案
        {
          const t2 = window.setTimeout(() => {
            if (!overlaysActiveRef.current || currentZoomRef.current >= 6) return
            try {
              const isRaster = mapInstanceRef.current?.getRenderingType?.() === 'RASTER'
              if (isRaster) {
                clearStateOverlays()
                if (overlaysActiveRef.current && currentZoomRef.current < 6) {
                  createEnhancedFallbackOverlay()
                }
              }
            } catch (checkError) {}
          }, 2000)
          overlayTimersRef.current.push(t2 as unknown as number)
        }
        

        
      } catch (err: any) {
        // 降级方案：使用增强的覆盖方案
        createEnhancedFallbackOverlay()
      }
    }

    // 添加州标签显示客户数量（格式: CA: 2）
    const addStateLabels = async (stateStats: Map<string, number>) => {
      try {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker") as any

        // 安全检查数据对象是否存在
        if (!STATE_CENTER_COORDS) {
          return
        }

        // 遍历所有有客户的州并在其预定义的中心坐标显示标签
        stateStats.forEach((customerCount, stateAbbr) => {
          try {
            if (!stateAbbr || typeof stateAbbr !== 'string') {
              return
            }

            // 只处理美国州，过滤掉加拿大省份等
            if (!STATE_POPULATION_DATA || !STATE_POPULATION_DATA[stateAbbr]) {
              return
            }

            // 使用预定义的州中心坐标
            const centerCoords = STATE_CENTER_COORDS[stateAbbr]
            if (!centerCoords) {
              return
            }

          // 创建州标签 (格式: CA: 2)
          const labelElement = document.createElement('div')
          labelElement.innerHTML = `
            <div style="
              background: rgba(248, 248, 248, 0.9);
              border: 1px solid rgba(200, 200, 200, 0.7);
              border-radius: 8px;
              padding: 6px 10px;
              font-family: Arial, sans-serif;
              font-size: 14px;
              font-weight: bold;
              color: #333;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              white-space: nowrap;
            ">
              ${stateAbbr}: ${customerCount}
            </div>
          `

          const stateLabel = new AdvancedMarkerElement({
            position: centerCoords,
            map: mapInstanceRef.current,
            content: labelElement
          })

          statePolygonsRef.current.push(stateLabel)
          } catch (labelError) {
            // 忽略标签创建错误
          }
        })
      } catch (err) {
        // 忽略标签创建错误
      }
    }


    // 美国各州中心坐标数据（用于降级方案）
    const STATE_CENTER_COORDS: { [stateAbbr: string]: { lat: number; lng: number } } = {
      "AL": { lat: 32.806671, lng: -86.791130 }, // Alabama
      "AK": { lat: 61.570716, lng: -152.404419 }, // Alaska
      "AZ": { lat: 33.729759, lng: -111.431221 }, // Arizona
      "AR": { lat: 34.969704, lng: -92.373123 }, // Arkansas
      "CA": { lat: 36.116203, lng: -119.681564 }, // California
      "CO": { lat: 39.059811, lng: -105.311104 }, // Colorado
      "CT": { lat: 41.597782, lng: -72.755371 }, // Connecticut
      "DE": { lat: 39.318523, lng: -75.507141 }, // Delaware
      "FL": { lat: 27.766279, lng: -81.686783 }, // Florida
      "GA": { lat: 33.040619, lng: -83.643074 }, // Georgia
      "HI": { lat: 21.094318, lng: -157.498337 }, // Hawaii
      "ID": { lat: 44.240459, lng: -114.478828 }, // Idaho
      "IL": { lat: 40.349457, lng: -88.986137 }, // Illinois
      "IN": { lat: 39.849426, lng: -86.258278 }, // Indiana
      "IA": { lat: 42.011539, lng: -93.210526 }, // Iowa
      "KS": { lat: 38.5266, lng: -96.726486 }, // Kansas
      "KY": { lat: 37.668140, lng: -84.670067 }, // Kentucky
      "LA": { lat: 31.169546, lng: -91.867805 }, // Louisiana
      "ME": { lat: 44.693947, lng: -69.381927 }, // Maine
      "MD": { lat: 39.063946, lng: -76.802101 }, // Maryland
      "MA": { lat: 42.230171, lng: -71.530106 }, // Massachusetts
      "MI": { lat: 43.326618, lng: -84.536095 }, // Michigan
      "MN": { lat: 45.694454, lng: -93.900192 }, // Minnesota
      "MS": { lat: 32.741646, lng: -89.678696 }, // Mississippi
      "MO": { lat: 38.572954, lng: -92.189283 }, // Missouri
      "MT": { lat: 47.052952, lng: -109.633040 }, // Montana
      "NE": { lat: 41.125370, lng: -98.268082 }, // Nebraska
      "NV": { lat: 38.313515, lng: -117.055374 }, // Nevada
      "NH": { lat: 43.452492, lng: -71.563896 }, // New Hampshire
      "NJ": { lat: 40.298904, lng: -74.521011 }, // New Jersey
      "NM": { lat: 34.840515, lng: -106.248482 }, // New Mexico
      "NY": { lat: 42.165726, lng: -74.948051 }, // New York
      "NC": { lat: 35.630066, lng: -79.806419 }, // North Carolina
      "ND": { lat: 47.528912, lng: -99.784012 }, // North Dakota
      "OH": { lat: 40.388783, lng: -82.764915 }, // Ohio
      "OK": { lat: 35.565342, lng: -96.928917 }, // Oklahoma
      "OR": { lat: 44.572021, lng: -122.070938 }, // Oregon
      "PA": { lat: 40.590752, lng: -77.209755 }, // Pennsylvania
      "RI": { lat: 41.680893, lng: -71.511780 }, // Rhode Island
      "SC": { lat: 33.856892, lng: -80.945007 }, // South Carolina
      "SD": { lat: 44.299782, lng: -99.438828 }, // South Dakota
      "TN": { lat: 35.747845, lng: -86.692345 }, // Tennessee
      "TX": { lat: 31.054487, lng: -97.563461 }, // Texas
      "UT": { lat: 40.150032, lng: -111.862434 }, // Utah
      "VT": { lat: 44.045876, lng: -72.710686 }, // Vermont
      "VA": { lat: 37.769337, lng: -78.169968 }, // Virginia
      "WA": { lat: 47.400902, lng: -121.490494 }, // Washington
      "WV": { lat: 38.491226, lng: -80.954570 }, // West Virginia
      "WI": { lat: 44.268543, lng: -89.616508 }, // Wisconsin
      "WY": { lat: 42.755966, lng: -107.302490 }, // Wyoming
      "DC": { lat: 38.897438, lng: -77.026817 }  // Washington DC
    }

    // 增强的降级覆盖方案（为不支持矢量地图的设备提供更好体验）
    const createEnhancedFallbackOverlay = () => {
      try {
        const stateStats = getCustomersByState()
        const maxCount = Math.max(...Array.from(stateStats.values()), 1)

        // 安全检查数据对象是否存在
        if (!STATE_POPULATION_DATA || !STATE_CENTER_COORDS) {
          return
        }

        // 安全地遍历所有美国州（基于人口数据），包括没有客户的州
        const stateKeys = STATE_POPULATION_DATA ? Object.keys(STATE_POPULATION_DATA) : []
        stateKeys.forEach(stateAbbr => {
          try {
            if (!stateAbbr || typeof stateAbbr !== 'string') {
              return
            }

            // 确保是美国州，因为我们只处理美国州数据
            if (!STATE_POPULATION_DATA[stateAbbr]) {
              return
            }

            const customerCount = stateStats.get(stateAbbr) || 0 // 没有客户的州显示0
            
            // 使用预定义的州中心坐标
            const centerCoords = STATE_CENTER_COORDS[stateAbbr]
            if (!centerCoords) {
              return
            }

            // 安全获取基于人口的颜色（所有州都显示颜色）
        const fillColor = getStatePopulationColor(stateAbbr)
        
        // 计算动态标记大小
        const baseSize = 20 // 稍微减小基础大小，因为要显示所有州
        let markerSize = baseSize
        
        if (customerCount > 0) {
          // 有客户的州：动态大小
          const sizeMultiplier = Math.min(customerCount / maxCount, 1)
          markerSize = baseSize + (sizeMultiplier * 25) // 20-45 像素范围
        } else {
          // 没有客户的州：固定较小大小，但仍然可见
          markerSize = 15
        }

        // 创建自定义SVG标记
        const createCustomStateMarker = (size: number, color: string, hasCustomers: boolean) => {
          return {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: hasCustomers ? 0.8 : 0.6, // 没有客户的州稍微透明一些
            strokeColor: '#000000',
            strokeWeight: hasCustomers ? 2 : 1, // 没有客户的州边框更细
            strokeOpacity: hasCustomers ? 0.9 : 0.7,
            scale: size
          }
        }

        // 创建州标记
        const stateMarker = new window.google.maps.Marker({
          position: centerCoords,
          map: mapInstanceRef.current,
          title: `${stateAbbr}: ${customerCount} customers (Population: ${STATE_POPULATION_DATA[stateAbbr]?.toLocaleString() || 'N/A'})`,
          icon: createCustomStateMarker(markerSize, fillColor, customerCount > 0),
          zIndex: customerCount > 0 ? 1000 + customerCount : 500 // 有客户的州显示在上层
        })


        // 添加点击事件显示详细信息
        stateMarker.addListener('click', () => {
          const population = (STATE_POPULATION_DATA && STATE_POPULATION_DATA[stateAbbr]) || 0
          const infoContent = `
            <div style="padding: 12px; font-family: system-ui; min-width: 200px;">
              <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: bold;">
                ${stateAbbr} State
              </h3>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #6b7280;">Customers:</span>
                  <span style="font-weight: bold; color: ${customerCount > 0 ? '#1f2937' : '#9ca3af'};">${customerCount}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #6b7280;">Population:</span>
                  <span style="font-weight: bold; color: #1f2937;">${population.toLocaleString()}</span>
                </div>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
                Enhanced fallback overlay (Vector map not supported)
              </div>
            </div>
          `
        
        if (infoWindowRef.current) {
          infoWindowRef.current.close()
        }
        
        infoWindowRef.current = new window.google.maps.InfoWindow({
          content: infoContent,
            position: centerCoords
        })
        
        infoWindowRef.current.open(mapInstanceRef.current)
      })

        statePolygonsRef.current.push(stateMarker)
          } catch (stateError) {
            // 忽略单个州标记创建错误
          }
      })

      } catch (error) {
        // 忽略覆盖层创建错误
      }
    }

    // 降级方案：简化的州覆盖（保留原有方案作为备用）
    const createSimpleStateOverlays = () => {
      const stateStats = getCustomersByState()
      const maxCount = Math.max(...Array.from(stateStats.values()), 1)
      
      const stateCustomers = new Map<string, Customer[]>()
      customers.forEach(customer => {
        const state = customer.state?.trim()
        if (state && state.length === 2) {
          // 只处理美国州的客户数据
          if (STATE_POPULATION_DATA && STATE_POPULATION_DATA[state]) {
          if (!stateCustomers.has(state)) {
            stateCustomers.set(state, [])
          }
          stateCustomers.get(state)!.push(customer)
          }
        }
      })

      stateCustomers.forEach((customers, state) => {
        if (customers.length === 0) return

        // 只处理美国州，跳过加拿大省份等
        if (!STATE_POPULATION_DATA || !STATE_POPULATION_DATA[state]) {
          return
        }

        const centerLat = customers.reduce((sum, c) => sum + c.lat, 0) / customers.length
        const centerLng = customers.reduce((sum, c) => sum + c.lng, 0) / customers.length
        const customerCount = customers.length
        // 使用基于人口的颜色（而非客户数量）
        const fillColor = getStatePopulationColor(state)
        
        const stateCircle = new window.google.maps.Circle({
          center: { lat: centerLat, lng: centerLng },
          radius: Math.max(150000, customerCount * 50000), // 半径仍基于客户数量
          fillColor: fillColor,
          fillOpacity: 0.6, // 保持透明度
          strokeColor: '#000',
          strokeOpacity: 0.8,
          strokeWeight: 3, // 边框宽度
          map: mapInstanceRef.current
        })

        statePolygonsRef.current.push(stateCircle)
      })
      

    }

    // 清除州级覆盖
    const clearStateOverlays = () => {
      // 关闭州覆盖层活动标记
      overlaysActiveRef.current = false
      // 清理所有延迟回调
      overlayTimersRef.current.forEach(id => clearTimeout(id))
      overlayTimersRef.current = []

      statePolygonsRef.current.forEach(layer => {
        try {
          if (layer && typeof layer.setMap === 'function') {
            layer.setMap(null)
          } else if (layer && 'style' in layer) {
            ;(layer as any).style = null
          } else if (layer && 'map' in layer) {
            // 例如 AdvancedMarkerElement
            ;(layer as any).map = null
          }
        } catch (_) {}
      })
      statePolygonsRef.current = []
    }

    // 加载Google Maps API
    useEffect(() => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyBMkDXChYggBlWNUOOA7ysyf24eWRgf8sg"

      if (!apiKey) {
        setError("Google Maps API key not set")
        return
      }

      // 检查是否已经加载
      if (window.google && window.google.maps) {
        setIsLoaded(true)
        return
      }

      // 检查是否已经有脚本正在加载
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        // 如果脚本已存在，等待其加载完成
        const checkLoaded = setInterval(() => {
          if (window.google && window.google.maps) {
            setIsLoaded(true)
            clearInterval(checkLoaded)
          }
        }, 100)
        
        // 10秒后停止检查，避免无限等待
        setTimeout(() => clearInterval(checkLoaded), 10000)
        return
      }

      // 使用更稳定的全局回调函数名，避免随机ID导致的问题
      const callbackName = 'initGoogleMapCallback'

      // 创建回调函数
      const initCallback = () => {
        try {
          setIsLoaded(true)
        } catch (err: any) {
          setError('Google Maps initialization failed')
        }
      }

      // 设置全局回调函数
      if (!window[callbackName as any]) {
      (window as any)[callbackName] = initCallback
      }

      const script = document.createElement("script")
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`
      script.async = true
      script.defer = true

      script.onerror = () => {
        const errorMsg = "Failed to load Google Maps API script, please check if the API key is correct"
        setError(errorMsg)
      }

      // 添加加载成功监听
      script.onload = () => {
        // 脚本加载成功，但回调函数可能还未执行
        // 设置一个备用检查机制
        if (!window.google?.maps) {
        setTimeout(() => {
            if (!window.google?.maps) {
              setError('Google Maps API loaded but not available')
          }
          }, 3000)
        }
      }

      document.head.appendChild(script)

      return () => {
        // 清理函数 - 只在组件卸载时执行
        if (script.parentNode) {
          try {
          script.parentNode.removeChild(script)
          } catch (err) {
            // 忽略移除脚本时的错误
          }
        }
      }
    }, [])

    // 检测是否为移动设备
    const isMobileDevice = () => {
      if (typeof window === 'undefined') return false
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
             window.innerWidth <= 768
    }

    // 初始化地图
    useEffect(() => {
      if (!isLoaded || !mapRef.current || !window.google) return

      try {
        // 验证州级数据完整性
        if (!validateStateData()) {
          setError('State data validation failed')
          return
        }
        
        // 检查环境变量配置
        checkEnvironmentConfig()
        
        const mapStyles = [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.business",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.medical",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.school",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.government",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.place_of_worship",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.attraction",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "poi.park",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "transit",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "transit.station",
            stylers: [{ visibility: "off" }],
          },
        ]

        // 创建地图配置
        const mapConfig: any = {
          zoom: 5,
          center: { lat: 40.0, lng: -96.0 }, // 向下调整地图中心以减少加拿大显示
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          styles: mapStyles, // 应用地图样式
          // 添加 Map ID 以启用 data-driven styling
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID', // 从环境变量获取或使用默认值
        }

        // 在移动端设置最小缩放级别为4
        if (isMobileDevice()) {
          mapConfig.minZoom = 4
        }

        // 创建地图实例
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapConfig)

        // 添加缩放级别变化监听器
        mapInstanceRef.current.addListener('zoom_changed', () => {
          const newZoom = mapInstanceRef.current.getZoom()
          
          // 在移动端防止缩放到小于4级
          if (isMobileDevice() && newZoom < 4) {
            mapInstanceRef.current.setZoom(4)
            return
          }
          
          setCurrentZoom(newZoom)
        })

        // 创建信息窗口
        infoWindowRef.current = new window.google.maps.InfoWindow()

        // 初始化时根据缩放级别显示相应内容
        if (currentZoom < 6) {
          createStateOverlays().catch(() => {})
        } else {
          createMarkers()
        }
      } catch (err) {
        const errorMsg = `Map initialization failed: ${err}`
        setError(errorMsg)
      }
    }, [isLoaded])

    const createMarkers = () => {
      if (!mapInstanceRef.current || !window.google?.maps || !customers?.length) {
        return
      }

      // 延迟创建标记，提高性能
      requestAnimationFrame(() => {
        createMarkersInternal()
      })
    }

    const createMarkersInternal = () => {
      if (!mapInstanceRef.current || !window.google?.maps || !customers?.length) {
        return
      }

      try {
        // 清除现有标记和圆形覆盖层
        markersRef.current.forEach((marker) => marker.setMap(null))
        circlesRef.current.forEach((circle) => circle.setMap(null)) // 清除现有圆形覆盖层
        markersRef.current = []
        circlesRef.current = []

        // 根据缩放级别决定是否显示标记
        if (currentZoom < 6) {
          return
        }

        // 创建新标记和圆形覆盖层（只在缩放级别6+时）
        // 每个地址根据自己的totalAmount显示不同大小的圆圈
        customers.forEach((customer, index) => {
          const addressSales = customer.totalAmount || 0  // 直接使用每个地址的销售金额
          const color = getColorByAmount(addressSales)
          const markerRadius = getMarkerSizeByAmount(addressSales)
          const isSelected = selectedCustomer?.id === customer.id
          
          const markerSize = markerRadius * 2 + 8
          const markerIcon = isSelected 
            ? createSalesBasedMarker("#ef4444", markerRadius, true)
            : createSalesBasedMarker(color, markerRadius, false)


          const marker = new window.google.maps.Marker({
            position: { lat: customer.lat, lng: customer.lng },
            map: mapInstanceRef.current,
            title: `${customer.companyName} - ${customer.address} (Sales: ${addressSales.toLocaleString()})`,
            icon: {
              url: markerIcon,
              scaledSize: new window.google.maps.Size(markerSize, markerSize),
              anchor: new window.google.maps.Point(markerSize/2, markerSize/2),
            },
          })

          if (customer.salesRadius) {
            const circle = new window.google.maps.Circle({
              strokeColor: color,
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: color,
              fillOpacity: 0.15,
              map: showSalesRange ? mapInstanceRef.current : null,
              center: { lat: customer.lat, lng: customer.lng },
              radius: customer.salesRadius * 1000, // 转换为米
            })
            circlesRef.current.push(circle)
          }

          // 添加点击事件
          marker.addListener("click", () => {
            onCustomerSelect(customer)

            // 显示信息窗口
            const content = `
            <div class="p-3 min-w-[250px]">
              <h3 class="font-semibold text-lg mb-2">${customer.companyName}</h3>
              <p class="text-sm mb-1"><strong>Customer ID:</strong> ${customer.customerId}</p>
              <p class="text-sm mb-1"><strong>Address ID:</strong> ${customer.addressId}</p>
              <p class="text-sm mb-1"><strong>Email:</strong> ${customer.email}</p>
              <p class="text-sm mb-1"><strong>Phone:</strong> ${customer.phone}</p>
              <p class="text-sm mb-2"><strong>Address:</strong> ${customer.address}</p>
              <p class="text-sm mb-2"><strong>Sales Amount:</strong> $${addressSales.toLocaleString()}</p>
              ${customer.salesRadius ? `<p class="text-sm mb-2"><strong>Sales Range:</strong> ${customer.salesRadius}km</p>` : ""}
              <div class="flex flex-wrap gap-1">
                ${customer.tags.map((tag) => `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">${tag}</span>`).join("")}
              </div>
            </div>
          `

            infoWindowRef.current.setContent(content)
            infoWindowRef.current.open(mapInstanceRef.current, marker)
          })

          markersRef.current.push(marker)
        })

        // 注释掉自动调整缩放逻辑，保持用户设置的缩放级别
        // 用户可以通过"重置视图"按钮来查看所有标记
        // if (customers.length > 0) {
        //   const bounds = new window.google.maps.LatLngBounds()
        //   customers.forEach((customer) => {
        //     bounds.extend({ lat: customer.lat, lng: customer.lng })
        //   })
        //   mapInstanceRef.current.fitBounds(bounds)
        //
        //   // 如果只有一个标记，设置合适的缩放级别
        //   if (customers.length === 1) {
        //     mapInstanceRef.current.setZoom(15)
        //   }
        // }

      } catch (err) {
        const errorMsg = `Marker creation failed: ${err}`
        setError(errorMsg)
      }
    }

    useEffect(() => {
      circlesRef.current.forEach((circle) => {
        circle.setMap(showSalesRange ? mapInstanceRef.current : null)
      })
    }, [showSalesRange])

    // 监听缩放级别变化，控制显示内容
    useEffect(() => {
      if (!mapInstanceRef.current) return
      
      if (currentZoom < 6) {
        // 缩放级别小于6，显示州级覆盖，隐藏标记
        createStateOverlays().catch(() => {})
        // 清除标记但保留在引用中，以便快速恢复
        markersRef.current.forEach((marker) => marker.setMap(null))
        circlesRef.current.forEach((circle) => circle.setMap(null))

      } else {
        // 缩放级别大于等于6，隐藏州级覆盖，显示标记
        clearStateOverlays()
        createMarkers()

      }
    }, [currentZoom, customers])

    useEffect(() => {
      if (currentZoom >= 6) {
      createMarkers()
      }
    }, [customers, selectedCustomer, onCustomerSelect, currentZoom])

    // 当选中客户改变时，移动地图中心
    useEffect(() => {
      if (!selectedCustomer || !mapInstanceRef.current) return

      mapInstanceRef.current.panTo({ lat: selectedCustomer.lat, lng: selectedCustomer.lng })
      
      // 在移动端使用适中的缩放级别，避免过度放大
      const customerZoom = isMobileDevice() ? Math.min(12, 15) : 15 // 移动端最大12级，桌面端15级
      mapInstanceRef.current.setZoom(customerZoom)
    }, [selectedCustomer])

    const resetView = () => {
      if (!mapInstanceRef.current || !window.google) return

      // 重置到固定的缩放级别和中心位置
      mapInstanceRef.current.setCenter({ lat: 40.0, lng: -96.0 }) // 向下调整地图中心以减少加拿大显示
      
      // 根据设备类型设置合适的缩放级别
      const resetZoom = isMobileDevice() ? Math.max(4, 5) : 5 // 移动端最小4级
      mapInstanceRef.current.setZoom(resetZoom)

      // 关闭信息窗口
      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }


    }

    useImperativeHandle(ref, () => ({
      resetView,
    }))

    const actualApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyBMkDXChYggBlWNUOOA7ysyf24eWRgf8sg"

    if (!actualApiKey) {
      return (
        <div className="h-full flex items-center justify-center bg-muted">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Please set Google Maps API key</p>
            <p className="text-sm text-muted-foreground">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to environment variables</p>
            <p className="text-xs text-red-500 mt-2">Make sure to use NEXT_PUBLIC_ prefix</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="h-full flex items-center justify-center bg-muted">
          <div className="text-center max-w-md">
            <p className="text-red-500 mb-2">Map loading error</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground">
              Please check: 1. API key is correct 2. Maps JavaScript API is enabled 3. Domain is in API restrictions
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full w-full relative">
        <div ref={mapRef} className="h-full w-full" />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
      </div>
    )
  },
)

GoogleMap.displayName = "GoogleMap"
