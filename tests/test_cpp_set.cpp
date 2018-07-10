/**
 *
 *	https://www.onlinegdb.com/online_c++_compiler
 */
#include <iostream>
#include <set>


typedef struct tagCustomComparator
{
    bool operator()(const int& lhs, const int& rhs)
    {
        return lhs < rhs;
    }

}STCUSTOMCOMPARATOR, *LPSTCUSTOMCOMPARATOR;


int main()
{
    std::set<int,STCUSTOMCOMPARATOR> setQueue;
    std::set<int,STCUSTOMCOMPARATOR>::iterator it;

    setQueue.insert( 1 );
    setQueue.insert( 2 );
    setQueue.insert( 6 );
    setQueue.insert( 7 );
    setQueue.insert( 700000 );
    setQueue.insert( 88 );
    setQueue.insert( 100 );
    setQueue.insert( 0 );

    for ( it = setQueue.begin(); it != setQueue.end(); ++it )
    {
        std::cout << " " << *it;
    }

    std::cout << "\r\n";

    return 0;
}
