#!/usr/bin/env python3
"""
批量地理编码脚本
用于将所有地址的坐标更新到数据库中
"""

import requests
import time
import json

BASE_URL = "http://localhost:8000"

def get_geocode_status():
    """获取地理编码状态"""
    response = requests.get(f"{BASE_URL}/api/geocode/status")
    return response.json()

def batch_update_coordinates(limit=50, offset=0):
    """批量更新坐标"""
    response = requests.post(f"{BASE_URL}/api/geocode/batch-update", params={
        "limit": limit,
        "offset": offset
    })
    return response.json()

def main():
    """主函数"""
    print("🚀 开始批量地理编码...")
    
    # 获取初始状态
    status = get_geocode_status()
    total_addresses = status['total_addresses']
    remaining = status['without_coordinates']
    
    print(f"📊 总地址数: {total_addresses}")
    print(f"🎯 需要处理: {remaining} 个地址")
    
    if remaining == 0:
        print("✅ 所有地址都已有坐标！")
        return
    
    batch_size = 50
    offset = 0
    total_processed = 0
    total_successful = 0
    total_failed = 0
    
    while remaining > 0:
        print(f"\n🔄 处理第 {offset + 1} - {min(offset + batch_size, total_addresses)} 个地址...")
        
        try:
            result = batch_update_coordinates(limit=batch_size, offset=offset)
            
            processed = result.get('processed', 0)
            successful = result.get('successful', 0) 
            failed = result.get('failed', 0)
            
            total_processed += processed
            total_successful += successful
            total_failed += failed
            
            print(f"   ✅ 成功: {successful}")
            print(f"   ❌ 失败: {failed}")
            print(f"   📈 总进度: {total_successful}/{total_addresses} ({(total_successful/total_addresses*100):.1f}%)")
            
            if processed == 0:
                break
                
            offset += batch_size
            remaining -= processed
            
            # 避免API限制
            print("   ⏱️  等待 3 秒...")
            time.sleep(3)
            
        except Exception as e:
            print(f"   ❌ 批处理出错: {e}")
            break
    
    # 获取最终状态
    final_status = get_geocode_status()
    print(f"\n🎉 批量地理编码完成！")
    print(f"📊 最终统计:")
    print(f"   - 总地址数: {final_status['total_addresses']}")
    print(f"   - 有坐标: {final_status['with_coordinates']}")
    print(f"   - 无坐标: {final_status['without_coordinates']}")
    print(f"   - 完成率: {final_status['completion_rate']:.2f}%")

if __name__ == "__main__":
    main()
