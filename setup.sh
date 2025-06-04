#!/bin/bash
# Script để khởi tạo và kiểm tra hoạt động của PostgreSQL và Redis cho GoTracking

set -e

echo "====== Khởi tạo môi trường GoTracking Database ======"

# Kiểm tra xem docker và docker-compose đã được cài đặt chưa
if ! command -v docker &> /dev/null; then
    echo "Docker chưa được cài đặt. Vui lòng cài đặt Docker trước."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose chưa được cài đặt. Vui lòng cài đặt Docker Compose trước."
    exit 1
fi

# Tạo và khởi động các container
echo "1. Khởi động các container..."
docker-compose up -d

echo "2. Đợi PostgreSQL khởi động hoàn tất..."
sleep 5
until docker exec gotracking-postgres pg_isready -U gotracking; do
    echo "PostgreSQL đang khởi động, đợi 5 giây..."
    sleep 5
done

echo "3. Kiểm tra kết nối Redis..."
if docker exec gotracking-redis redis-cli ping | grep -q "PONG"; then
    echo "Redis đã sẵn sàng!"
else
    echo "Redis chưa khởi động đúng. Kiểm tra logs với lệnh: docker logs gotracking-redis"
fi

echo "4. Kiểm tra cài đặt database..."
# Kiểm tra xem các schema đã được tạo chưa
SCHEMA_COUNT=$(docker exec gotracking-postgres psql -U gotracking -d gotracking_db -t -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = 'gotracking';")
if [ "$SCHEMA_COUNT" -eq 1 ]; then
    echo "Schema gotracking đã được tạo thành công!"
    
    # Kiểm tra các bảng đã được tạo
    TABLE_COUNT=$(docker exec gotracking-postgres psql -U gotracking -d gotracking_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'gotracking';")
    echo "Đã tạo $TABLE_COUNT bảng trong schema gotracking."
    
    # Kiểm tra dữ liệu sample
    USER_COUNT=$(docker exec gotracking-postgres psql -U gotracking -d gotracking_db -t -c "SELECT COUNT(*) FROM gotracking.users;")
    echo "Có $USER_COUNT người dùng trong hệ thống."
else
    echo "Schema gotracking chưa được tạo. Có vấn đề với script khởi tạo."
    echo "Kiểm tra logs với lệnh: docker logs gotracking-postgres"
    exit 1
fi

echo "5. Thông tin kết nối Database:"
echo "PostgreSQL đang chạy tại: localhost:5432"
echo "Tên database: gotracking_db"
echo "Username: gotracking"
echo "Password: gotracking_password"
echo ""
echo "Thông tin quản trị:"
echo "PgAdmin đang chạy tại: http://localhost:8080"
echo "Email: admin@gotracking.com"
echo "Password: admin_password"
echo ""
echo "Redis đang chạy tại: localhost:6379"
echo "Redis Commander UI: http://localhost:8081"

echo "====== Cài đặt hoàn tất! ======"
echo "Sử dụng lệnh sau để dừng các container:"
echo "docker-compose down"
echo ""
echo "Sử dụng lệnh sau để xem logs của PostgreSQL:"
echo "docker logs gotracking-postgres"